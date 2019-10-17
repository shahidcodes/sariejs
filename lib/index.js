/* eslint-disable guard-for-in */
/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
const path = require("path");
const globPromise = require("glob-promise");
const express = require("express");
const bodyParser = require('body-parser');

const NODE_ENV = process.env.NODE_ENV || "development";
const mongoose = require("mongoose");
const sanitizeFileName = require("./utils/sanitizeFileName");
const EventEmitter = require("./utils/EventEmitter");
const logger = require("./utils/logger")('log: ');

const app = express();
class Tempest {
  constructor() {
    this.dirPath = path.dirname(require.main.filename);
    this.appConfig = {};
    this.databases = {};
    this.emitter = new EventEmitter();
  }

  onBeforeRoutesRegistered(cb) {
    this.beforeRegisterRouteHookCb = cb;
    return this;
  }

  onAfterRoutesRegistered(cb) {
    this.afterRegisterRouteHookCb = cb;
    return this;
  }

  onBeforeInit(cb) {
    this.onBeforeCb = cb;
    return this;
  }

  onAfterInit(cb) {
    this.onAfterInitCb = cb;
    return this;
  }

  async start() {
    const configPath = path.resolve(this.dirPath, `environments/${NODE_ENV}/**/*.js`);
    const configFiles = await globPromise(configPath);
    configFiles.forEach((file) => {
      this.appConfig = { ...this.appConfig, ...require(file) };
    });
    await this.runBeforeHook();
    this.emitter.emit("before:hook");
    await this.connectDbs();
    this.emitter.emit("database:connected");
    await this.registerModels();
    this.emitter.emit("models:initialized");
    await this.beforeRegisterRouteHook();
    this.emitter.emit("before:router:registerd");
    await this.registerRoutes();
    this.emitter.emit("routes:registered");
    await this.afterRegisterRouteHook();
    await this.startServer();
    this.emitter.emit("server:started");
    await this.runAfterHook();
  }


  async connectDbs() {
    for (const database of this.appConfig.databases) {
      try {
        const dbUri = `mongodb://${database.user}:${database.pwd}@${database.host}:${database.port}/${database.name}`;
        logger.log(dbUri);
        const { connection } = await mongoose.connect(dbUri, database.options);
        logger.log(`DB Connected: ${database.name}`);
        this.databases[database.name] = connection;
      } catch (error) {
        logger.error(error);
        process.exit(0);
      }
    }
  }

  async registerModels() {
    const modelPath = path.resolve(this.dirPath, `api/**/models/*.js`);
    const modelSchemas = await globPromise(modelPath);
    for (const modelFile of modelSchemas) {
      const model = require(modelFile);
      global[sanitizeFileName(model.collectionName)] = this.databases[model.dbName]
        .model(model.collectionName, model.schema);
    }
  }

  async beforeRegisterRouteHook() {
    if (this.beforeRegisterRouteHookCb) {
      this.beforeRegisterRouteHookCb(app);
    }
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());
  }

  async registerRoutes() {
    const routesPath = path.resolve(this.dirPath, `api/**/routes.js`);
    const routes = await globPromise(routesPath);
    for (const route of routes) {
      const currentApiDirectory = path.dirname(route);
      const rt = require(route);
      for (let method in rt) {
        method = method.toLowerCase();
        const endpoints = rt[method];
        if (endpoints) {
          for (const endpoint in endpoints) {
            const endpointConfig = endpoints[endpoint];
            const middlewareNames = endpointConfig.middlewares;
            const middlewares = middlewareNames.map((name) => {
              const namePath = path.resolve(currentApiDirectory, `middlewares/${name}.js`);
              return require(namePath);
            });
            const controllerPaths = endpointConfig.action.split(".");
            const controllerName = controllerPaths[0]; // Todo.some() => Todo
            const callback = controllerPaths[1];
            const controllerPath = path.resolve(currentApiDirectory, `controllers/${controllerName}.controller.js`);
            const controller = require(controllerPath);
            if (middlewares.length > 0) {
              app[method](endpoint, ...middlewares, controller[callback]);
            } else app[method](endpoint, ...middlewares, controller[callback]);

          }
        }
      }
    }
  }

  async afterRegisterRouteHook() {
    if (this.afterRegisterRouteHookCb) {
      this.afterRegisterRouteHookCb(app);
      this.emitter.emit("after:router:registered");
    }
  }

  async startServer() {
    app.listen(this.appConfig.server.port, () => logger.log("Server started"));
  }

  async runBeforeHook() {
    if (this.onBeforeCb) {
      await this.onBeforeCb();
    }
  }

  async runAfterHook() {
    if (this.onAfterInitCb) {
      await this.onAfterInitCb(app);
    }
  }
}


module.exports = new Tempest();
