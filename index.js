'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');
var https = require('https');
var flags = require('node-flags');
var app = module.exports = require('./server/server');
var logger = require('./common/utils/logger');

if (require.main === module) {

    app.boot()
    .then(() => {
        let httpOnly = process.env.HTTP;
        let port =  flags.get('port') || app.get('port');

        if (typeof httpOnly === 'undefined') httpOnly = false;
        let server = null;
        if (httpOnly) {
            server = http.createServer(app);
        } else {
            let options = {
                key: fs.readFileSync(path.join('.', 'private', 'privatekey.pem')),
                cert: fs.readFileSync(path.join('.', 'private', 'certificate.pem'))
            };
            server = https.createServer(options, app);
        }
        server.listen(port, () => {
            let baseUrl = `${httpOnly ? 'http' : 'https'}://${app.get('host')}:${port}`;
            app.emit('started', baseUrl);
            if (app.get('env') === 'development') {
                console.log('Web server listening at: %s', baseUrl);
                if (app.get('loopback-component-explorer')) {
                    let explorerPath = app.get('loopback-component-explorer').mountPath;
                    console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
                }
            }
        });
    }, (err) => {
        if (process.env.NODE_ENV === 'development') {
            logger.error(`Error: ${err.stack}`);
        } else {
            logger.error(`Error: ${err.message}`);
        }
    });
}
