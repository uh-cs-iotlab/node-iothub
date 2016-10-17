'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');
var https = require('https');
var flags = require('node-flags');
var app = module.exports = require('./server/server');
var logger = require('./common/utils/logger');

if (require.main === module) {
    let options = {}

    if (process.env.NOW) {
        process.env.NODE_ENV = 'production';
    }
    if (flags.get('adminUser') && flags.get('adminPass') && flags.get('adminEmail')) {
        options.adminCredentials = {
            username: flags.get('adminUser'),
            password: flags.get('adminPass'),
            email: flags.get('adminEmail')
        }
    }

    app.boot(options)
    .then(() => {
        let httpOnly = process.env.HTTP;
        let port =  flags.get('port') || app.get('port');

        if (typeof httpOnly === 'undefined') httpOnly = false;
        let server = null;

        // If http-only server requested, or running in ZEIT cloud, use http-server. ZEIT uses https, but
        // uses its own front server, and deploys app in a background machine.
        if (httpOnly || process.env.NOW) {
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
            if (app.get('env') === 'development' || app.get('env') === 'test') {
                console.log('Web server listening at: %s', baseUrl);
                if (app.get('loopback-component-explorer')) {
                    let explorerPath = app.get('loopback-component-explorer').mountPath;
                    console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
                }
            } else if (app.get('env') === 'production') {
                console.log('Production IoT hub started at : %s', baseUrl);
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
