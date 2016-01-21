var request = require('superagent'),
    async   = require('async');

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
        var feeds = {
            count: 0,
            types: []
        };
        async.each(['atomic', 'composed', 'executable'], function(feedType, callback) {
            redirectRoute(req, restApiRoot + '/feeds/' + feedType, function (err, res) {
                if(err) return callback(err);
                if(res.body.length > 0) {
                    feeds.count += res.body.length;
                    feeds.types.push(feedType);
                    feeds[feedType] = res.body;
                }
                callback();
            });
        }, function (err) {
            if(err) return res.status(err.status).send(err.response);
            res.status(200).send(feeds);
        });
    });

};
