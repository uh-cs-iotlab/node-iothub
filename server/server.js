var loopback = require('loopback');
var boot = require('loopback-boot');
var app = module.exports = loopback();

app.start = function() {
    // start the web server
    return app.listen(function() {
        app.emit('started');
        var baseUrl = app.get('url').replace(/\/$/, '');
        console.log('Web server listening at: %s', baseUrl);
        if (app.get('loopback-component-explorer')) {
            var explorerPath = app.get('loopback-component-explorer').mountPath;
            console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
        }
    });
};

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, {
    appRootDir: __dirname,
    // Normally, mixins are ignored if they are not referenced by any model in JSON definition.
    // Here we force mixins in these directories to be loaded so we can apply them programatically.
    mixinDirs: ['./mixins-static']
}, function(err) {
    if (err) throw err;
    // start the server if `$ node server.js`
    if (require.main === module)
    app.start();
});
