#!/usr/bin/env node

const httpProxy = require('http-proxy');
const connect = require('connect');
const http = require('http');
const url = require('url');
const fs = require('fs');
const harmonConf = require('harmon');
const program = require('commander');

//cli args
program
    .version('0.0.1')
    .option('-p, --port <n>', 'the proxy port for listen', parseInt)
    .option('-i, --inject-js [path]', 'the js file to inject')
    .parse(process.argv);

//required args
if (!program.port) {
    console.log("  Proxy port must be provided!!");
    program.help();
}

var proxy = httpProxy.createProxyServer({}); //create new server proxy

proxy.on('error', function(err, req, res) {
    console.error(err);
    responseError(err.toString(), res);
});

var app = connect(); //create connect middleware

if(program.injectJs) { //if js file is provided
    var htmlToInject;

    //read jsFile and generate full html node
    fs.readFile(program.injectJs, function(err, buffer) {
        if(err) {
            console.error(err);
            process.exit();
        }
        htmlToInject = generateScriptTag(buffer.toString()); //generate html node
    });

    function generateScriptTag(scriptContent) {
        return '<script type="text/javascript">' + scriptContent + ' </script>'
    }

    //action to append script to the head tag
    var scriptInjectorAction = {
        query : 'head',
        func: function(htmlNode) {
            var rStream = htmlNode.createReadStream();
            var vStream = htmlNode.createWriteStream({ 'flags': 'w' });

            rStream.on('data', function(chunk) {
                vStream.write(chunk);
            });

            rStream.on('end', function() {
                vStream.end(htmlToInject);
            });
        }
    };

    var harmon = harmonConf([], [scriptInjectorAction], true);
    app.use(harmon); //set harmon middleware to process the actions
}


//handler for requests
app.use(function(req, res) {
    var urlParsed = url.parse(req.url);
    var location = urlParsed.protocol + "//" + urlParsed.hostname;

    //redirect request to original location
    proxy.web(req, res, {
        target: location
    });
});

function responseError(errStr, res) {
    res.writeHead(500, {
        'Content-Type': 'text/html'
    });

  res.end('Error from proxy:</br><b>' + errStr + '</b>');
}

var server = http.createServer(app); //create new http server with the middleware

console.log("listening on port %j", program.port);
server.listen(program.port);
