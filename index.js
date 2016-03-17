'use strict';

var app = module.exports = require('./server/server');
var server;

if (require.main === module) {
    app.boot()
    .then(() => {
        server = app.listen(() => {
            if (app.get('env') === 'development') {
                var baseUrl = app.get('url').replace(/\/$/, '');
                console.log('Web server listening at: %s', baseUrl);
                if (app.get('loopback-component-explorer')) {
                    var explorerPath = app.get('loopback-component-explorer').mountPath;
                    console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
                }
            }
        });
    }, (err) => {
        console.error(`Error: ${err.message}`);
    });
}