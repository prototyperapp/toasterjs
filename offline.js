exports.runOffline = function(directory) {
  var express = require('express');
  var app = express();
  var bodyParser = require('body-parser')
  var fs = require("fs");
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({extended: true}));

  const PORT = 3000;

  console.log("Running " + directory + "/app.js");
  var api = require(directory + "/app.js");

  // Does the api json file exist?
  try {
    fs.statSync(directory + "/api.json");
  } catch (e) {
    console.error(directory + "/api.json file does not exist");
    return;
  }

  var apiJson = require(directory + "/api.json");

  if (!apiJson || !apiJson.paths || apiJson.paths.length == 0) {
    console.error("Could not find any endpoints in your API Json file");
    return;
  }

  // Loop through our api json to generate the offline methods
  Object.keys(apiJson.paths).forEach(function(pathKey) {
    var path = apiJson.paths[pathKey];

    Object.keys(path).forEach(function(method) {
      var methodDefinition = path[method];
      methodDefinition.method = method;
      methodDefinition.path = pathKey;

      // Replace any path parameters, e.g. {name} with :name as this is the way ExpressJS expects them to be
      while (methodDefinition.path.indexOf("{") >= 0) {
        var indexOfParamStart = methodDefinition.path.indexOf("{");
        var indexOfParamEnd = methodDefinition.path.indexOf("}");
        var paramLength = indexOfParamEnd - indexOfParamStart - 1;
        var param = methodDefinition.path.substr(indexOfParamStart + 1, paramLength);
        methodDefinition.path = methodDefinition.path.substr(0, indexOfParamStart) + ":" + param +  methodDefinition.path.substr(indexOfParamEnd + 1);
      }

      app[method](methodDefinition.path, function(req, res) {
        handleMethod(req, res);
      });
    });
  });

  var convertParamsToClaudiaRoute = function(url) {
    var routeToReturn = "";
    var currentParam = null;

    for (var i = 0; i < url.length; i++) {
        if (url.charAt(i) == ":") {
          currentParam = "";
        } else if (currentParam != null) {
          if (url.charAt(i) == "/") {
            // This is the end of the param
            routeToReturn += "{" + currentParam + "}/";
            currentParam = null;
          } else {
            currentParam += url.charAt(i);
          }
        } else {
          routeToReturn += url.charAt(i);
        }
    }

    // Do we have a currentParam left?
    if (currentParam != null) {
      routeToReturn += "{" + currentParam + "}";
    }

    return routeToReturn;
  };

  var handleMethod = function(req, res) {
    var url = convertParamsToClaudiaRoute(req.route.path);

    if (url.indexOf("?") > 0) {
      url = url.substr(0, url.indexOf("?"));
    }

    api.router({
      context: {
        path: url,
        method: req.method
      },
      headers: req.headers,
      queryString: req.query,
      pathParams: req.params,
      body: req.body
    }, {done: function(err, result) {
      if (err) {
        res.writeHead(501, {"Content-Type": "application/json"});
        res.end(JSON.stringify({
          error: err
        }));
      } else {
        res.writeHead(200, {"Content-Type": "application/json"});
        res.end(JSON.stringify(result));
      }
    }});
  }

  app.listen(PORT, function() {
    console.log("🍞ToasterJS Offline Server listening on " + PORT);
  });
}
