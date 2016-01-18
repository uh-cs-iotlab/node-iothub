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
        .query(req.query)
        .end(cb);
    };

    var restApiRoot = app.get('restApiRoot');
    app.get(restApiRoot + '/feeds', function(req, res) {
        var ComposedFeed = app.models.ComposedFeed;
        var feeds = [];
        redirectRoute(req, restApiRoot + '/feeds/composed', function(err, composedRes) {
            if (err) return res.status(err.status).send(err.response);
            feeds = feeds.concat(composedRes.body);
            res.status(200).send(feeds);
        });
    });

};
