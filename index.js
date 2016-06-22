var ApiBuilder = require("claudia-api-builder");
var Promise = require('bluebird');
var handler = require('./handler');

module.exports = {
  api: new ApiBuilder(),
  authenticatorMethod: null,
  setAuthenticatorMethod: function(authenticatorMethod) {
    this.authenticatorMethod = authenticatorMethod;
  },
  start: function(rootDirectory, apiFilename) {
    console.log("Loading routes from", rootDirectory + "/" + apiFilename);
    var apiFile = require(rootDirectory + "/" + apiFilename);

    if (!apiFile) {
      console.error("No filename for API JSON file specified");
      return;
    }

    // Add all route files to the handler
    handler.setApi(this.api);
    handler.setAuthenticatorMethod(this.authenticatorMethod);
    handler.addRouteFiles(rootDirectory + "/api", rootDirectory + "/api", this);

    Object.keys(apiFile.paths).forEach(function(pathKey) {
      var path = apiFile.paths[pathKey];

      Object.keys(path).forEach(function(method) {
        var methodDefinition = path[method];
        methodDefinition.method = method;
        methodDefinition.path = pathKey;
        handler.handle(methodDefinition);
      });
    });
  }

}
