'use strict';

var loopback = require('loopback');
var boot = require('loopback-boot');
var FileStreamRotator = require('file-stream-rotator');
var morgan = require('morgan');
var fs = require('fs');
var path = require('path');
var app = module.exports = loopback();
var flags = require('node-flags');

var logDirectory = path.join(__dirname, '..', 'logs');

// Do not try to create local logs when running in ZEIT cloud
if (!process.env.NOW) {
    fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);
    // create a rotating write stream
    var accessLogStream = FileStreamRotator.getStream({
        filename: path.join(logDirectory, 'access-%DATE%.log'),
        frequency: 'daily',
        verbose: false
    });
    // setup the logger
    app.use(morgan('combined', {stream: accessLogStream}));
}

app.set('view engine', 'jade');

// Set profiler on/off, mainly for executable feeds. Note that --profiler flag is not the same
// as Node's internal profiler that is setup with '--prof' flag
app.set('profiler', flags.get('profiler'));

app.boot = (options, cb) => {
    if (typeof options === 'function' && typeof cb === 'undefined') {
        cb = options;
        options = {};
    }
    options = Object.assign({
        appRootDir: __dirname,
        // Normally, mixins are ignored if they are not referenced by any model in JSON definition.
        // Here we force mixins in these directories to be loaded so we can apply them programatically.
        mixinDirs: ['./mixins-static']
    }, options);
    if (options.hasOwnProperty('adminCredentials')) {
        app.set('adminCredentialsObject', options.adminCredentials);
        delete options.adminCredentials;
    }
    var retP = Promise.all([
        new Promise((resolve) => {
            app.once('adminCreated', resolve);
        }),
        new Promise((resolve, reject) => {
            // Bootstrap the application, configure models, datasources and middleware.
            // Sub-apps like REST API are mounted via boot scripts.
            app.once('booted', resolve);
            boot(app, options, (err) => {
                if (err) reject(err);
            });
        })
    ]);
    if (cb) retP.then(() => cb(), (err) => cb(err));
    return retP;
};
