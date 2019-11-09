#!/usr/bin/env node

const { ArgumentParser } = require('argparse');
const path = require('path');
const downloadGitRepo = require('download-git-repo');
const { existsSync } = require('fs');
const { exec } = require('child_process');

const parser = new ArgumentParser({
  version: '0.1.1',
  addHelp: true,
  description: 'CLI script to generate projects',
});

parser.addArgument(['-F', '--force'], {
  help: 'override existing app directory',
  nargs: 0,
  defaultValue: false,
});

parser.addArgument(['-C', '--create'], {
  help: 'creates a Sarijs app',
  nargs: '*',
});

const args = parser.parseArgs();
const isForced = args.force;
const appName = (args.create || []).join(' ');
console.log(args);
const appDirectory = path.resolve(process.cwd(), appName);
if (!isForced && existsSync(appDirectory)) {
  console.error(`😫${appDirectory} already exists. Please pass --force to override.`);
  process.exit(-1);
}
const repoUrl = 'shahidcodes/sariejs-base';
console.log(`==> Creating app in ${appDirectory}`);
downloadGitRepo(repoUrl, appDirectory, {}, (err) => {
  if (!err) {
    console.log(`==> App created in ${appDirectory}`);
    console.log('==> Running npm install');
    const out = exec(`cd ${appDirectory} && npm install`);
    // out.stdout.on('data', console.log);
    // out.stderr.on('data', console.error);
    out.on('close', (code) => {
      if (code === 0) {
        console.log('==> Wohoo!! your app is created. Enjoy coding!');
      } else {
        console.error('<== Script failed with non standard code. Pleasse run npm install manually');
      }
    });
  } else {
    console.error('Error creating app. Here is what I know - ');
    console.error(err);
  }
});
