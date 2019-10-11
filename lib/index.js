const path = require("path");
const globPromise = require("glob-promise");
const NODE_ENV = process.env.NODE_ENV || "development"
const mongoose = require("mongoose")
const sanitizeFileName = require("./utils/sanitizeFileName")
const EventEmitter = require("./utils/EventEmitter");
const express = require("express")
const app = express()
class Tempest {

  constructor() {
    this._dirPath = path.dirname(require.main.filename);
    this.appConfig = {}
    this.databases = {}
    this.emitter = new EventEmitter()
  }

  async start() {
    const configPath = path.resolve(this._dirPath, `environments/${NODE_ENV}/**/*.js`);
    const configFiles = await globPromise(configPath);
    configFiles.forEach(file => {
      this.appConfig = { ...this.appConfig, ...require(file) }
    })
    await this.runBeforeHook();
    this.emitter.emit("before:hook");
    await this.connectDbs();
    this.emitter.emit("database:connected");
    await this.registerModels();
    this.emitter.emit("models:initialized");
    await this.registerRoutes();
    this.emitter.emit("routes:registered");
    await this.startServer();
    this.emitter.emit("server:started");
  }

  async connectDbs() {
    for (let database of this.appConfig.databases) {
      try {
        const dbUri = `mongodb://${database.user}:${database.pwd}@${database.host}:${database.port}/${database.name}`
        console.log(dbUri)
        const { connection } = await mongoose.connect(dbUri, database.options)
        console.log(`DB Connected: ${database.name}`)
        this.databases[database.name] = connection;
      } catch (error) {
        console.error(error)
        process.exit(0)
      }
    }
  }

  async registerModels() {
    const modelPath = path.resolve(this._dirPath, `api/**/models/*.js`);
    const modelSchemas = await globPromise(modelPath)
    for (let modelFile of modelSchemas) {
      const model = require(modelFile);
      global[sanitizeFileName(model.collectionName)] = this.databases[model.dbName].model(model.collectionName, model.schema)
    }
  }

  async registerRoutes() {
    const routesPath = path.resolve(this._dirPath, `api/**/routes.js`);
    const routes = await globPromise(routesPath);
    for (const route of routes) {
      const currentApiDirectory = path.dirname(route);
      const rt = require(route)
      for (let method in rt) {
        method = method.toLowerCase();
        let endpoints = rt[method];
        if (!endpoints) continue
        for (let endpoint in endpoints) {
          let endpointConfig = endpoints[endpoint];
          const controllerPaths = endpointConfig.action.split(".");
          const controllerName = controllerPaths[0]; // Todo.some() => Todo
          const callback = controllerPaths[1]
          const controllerPath = path.resolve(currentApiDirectory, `controllers/${controllerName}.controller.js`);
          const controller = require(controllerPath);
          console.log(method, controller[callback])
          app[method](endpoint, controller[callback])
        }
      }
    }

    app.listen(8001, cb => console.log("Server started"))
  }

  async startServer() {

  }

  async runBeforeHook() {

  }
}


module.exports = new Tempest()