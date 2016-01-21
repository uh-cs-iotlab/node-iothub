var request = require('superagent');

module.exports = function(app) {

    app.get('/', function(req, res) {
        res.send('Hello World!!!');
    });

    var redirectRoute = function(req, newRoute, cb) {
        var url = req.protocol + '://' + req.get('host') + newRoute;
        request(req.method, url)
        .set(req.headers || {})
        .send(req.body || {})
        .query(req.query || {})
        .end(cb);
    };

    var restApiRoot = app.get('restApiRoot');
    app.get(restApiRoot + '/feeds', function(req, res) {
        var ComposedFeed = app.models.ComposedFeed;
        var feeds = {
            count: 0,
            types: []
        };
        redirectRoute(req, restApiRoot + '/feeds/atomic', function(atomicErr, atomicRes) {
            if (atomicErr) return res.status(atomicErr.status).send(atomicErr.response);
            if (atomicRes.body.length > 0) {
                feeds.count += atomicRes.body.length;
                feeds.types.push('atomic');
                feeds.atomic = atomicRes.body;
            }
            redirectRoute(req, restApiRoot + '/feeds/composed', function(composedErr, composedRes) {
                if (composedErr) return res.status(composedErr.status).send(composedErr.response);
                if (composedRes.body.length > 0) {
                    feeds.count += composedRes.body.length;
                    feeds.types.push('composed');
                    feeds.composed = composedRes.body;
                }
                redirectRoute(req, restApiRoot + '/feeds/executable', function (executableErr, executableRes) {
                    if (executableErr) return res.status(executableErr.status).send(executableErr.response);
                    if (executableRes.body.length > 0) {
                        feeds.count += executableRes.body.length;
                        feeds.types.push('executable');
                        feeds.executable = executableRes.body;
                    }
                    
                    res.status(200).send(feeds);
                });
            });
        });
    });

};
