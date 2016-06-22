#!/usr/bin/env node

var offline = require("./offline");
var sh = require("shelljs");
const COMMAND_ARG_INDEX = 2;
const CURRENT_DIR_ARGUMENT = 1;

var currentDir = sh.pwd();

var returnHelp = function() {
  console.log("To run offline type toasterjs offline\n");
}

runOffline = function() {
  offline.runOffline(currentDir);
}

var main = function() {


  console.log("\n#################\n### ToasterJS ###\n#################\n");

  if (process.argv.length < 3) {
    returnHelp();
  }

  var command = process.argv[COMMAND_ARG_INDEX];

  if (command == "offline") {
    runOffline();
  } else {
    returnHelp();
  }
}

main();
console.log("\n");
