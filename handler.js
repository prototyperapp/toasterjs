var fs = require("fs");
var path = require("path");
var bluebird = require("bluebird");
var routeMap = {};

var api = null;
var authenticatorMethod = null;

exports.setApi = function(apiObj) {
  api = apiObj;
};

exports.setAuthenticatorMethod = function(authMethod) {
  authenticatorMethod = authMethod;
};

// Loop through all of the directories under /api and add the route files to the route map
exports.addRouteFiles = function(basePath, directory) {
  fs.readdirSync(directory).forEach(function(file) {
    if (fs.statSync(directory + "/" + file).isDirectory()) {
      exports.addRouteFiles(basePath, directory + "/" + file);
    } else {
      var routeKey = directory.substr(basePath.length);
      routeMap[routeKey] = require(directory + "/" + file);
    }
  });
};

var createApiMethod = function(methodDefinition, path, callback) {
  api[methodDefinition.method.toLowerCase()](path, callback);
};

var getRequestParameters = function(methodDefinition, req) {
  if (methodDefinition.method == "get") {
    return req.queryString;
  } else if (methodDefinition.method == "post" || methodDefinition.method == "delete" || methodDefinition.method == "put" || methodDefinition.method == "patch") {
    return req.body;
  } else {
    return {};
  }
};

var checkParameters = function(methodDefinition, req) {
  if (!methodDefinition.parameters || methodDefinition.parameters.length == 0) {
    return {errors: null, parameters: []};
  }

  // We have parameters, loop through and check them
  var verifiedParameters = {};
  var errors = [];

  var requestParams = getRequestParameters(methodDefinition, req);

  methodDefinition.parameters.forEach(function(parameter) {
    if (parameter.required && (!requestParams[parameter.name])) {
      errors.push("Missing required field '" + parameter.name + "'");
    } else {
      var fieldValue = requestParams[parameter.name];

      if (requestParams[parameter.name]) {
        // Parameter has a value, check its type if required
        if (parameter.type && parameter.type.toLowerCase() == "number") {
          if (!isNaN(fieldValue)) {
            fieldValue = Number(fieldValue);
          } else {
            errors.push("'" + parameter.name + "' must be a valid number");
          }
        }
      }

      // Everything ok
      if (errors.length == 0) {
        verifiedParameters[parameter.name] = fieldValue;
      }
    }
  });

  if (errors.length == 0) {
    errors = null;
  }

  return {errors: errors, parameters: verifiedParameters};

};

var getAuthedUserFromHeaders = function(req) {
  return new Promise(function(resolve, reject) {
    if (req.headers && req.headers["x-user-token"]) {
      // We have a user token
      if (authenticatorMethod) {
        authenticatorMethod(req.headers["x-user-token"], function(authUser) {
          resolve(authUser);
        });
      } else {
        resolve(null);
      }
    } else {
      resolve(null);
    }
  });
};

// Main handle method - this is where all api. methods get created
exports.handle = function(methodDefinition, req) {
  var routeFolder = methodDefinition.path.substr(0, methodDefinition.path.lastIndexOf("/"));
  var methodName = methodDefinition.path.substr(methodDefinition.path.lastIndexOf("/") + 1);

  if (routeMap[routeFolder]) {
    // Figure out where we are pulling this method from, i.e. if /user are we pulling it from the root routes.js
    // or are we getting it from the "/": method in the users/routes.js routes file
    var methodToUse;

    if (routeMap[routeFolder] && routeMap[routeFolder][methodName] && routeMap[routeFolder][methodName][methodDefinition.method]) {
      methodToUse = routeMap[routeFolder][methodName][methodDefinition.method];
    } else if (routeMap[routeFolder + "/" + methodName] && routeMap[routeFolder + "/" + methodName]["/"] && routeMap[routeFolder + "/" + methodName]["/"][methodDefinition.method]) {
      methodToUse = routeMap[routeFolder + "/" + methodName]["/"][methodDefinition.method];
    }

    if (methodToUse) {
      // Log out the method being created
      console.log(methodDefinition.method.toUpperCase() + ": " + methodDefinition.path);

      //Create the method
      createApiMethod(methodDefinition, routeFolder + "/" + methodName, function(req) {
        var checkedParameters = checkParameters(methodDefinition, req);

        if (checkedParameters.errors) {
          return new Promise(function(resolve, reject) {
            reject(checkedParameters.errors.join(", "));
          });
        } else {
          return getAuthedUserFromHeaders(req).then(function(authUser) {
            if (methodDefinition.authRequired && !authUser) {
              // Method requires auth, but user isn't auth'd
              return new Promise(function(resolve, reject) {
                reject("You must be logged in to call this endpoint");
              });
            } else {
              // User is auth'd or method doesn't require auth
              var environment = {
                authUser: authUser
              };

              return methodToUse(req, checkedParameters.parameters, environment);
            }
          });
        }
      });

    } else {
      console.log("Could not find method", methodDefinition.method.toUpperCase() + ":", routeFolder + "/" + methodName);
    }
  } else {
    console.log("Could not find route path", routeFolder);
  }
};
