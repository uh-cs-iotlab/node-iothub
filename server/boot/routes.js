var request = require('superagent');
var FeedTypes = require('../feed-types.json');

module.exports = function(app) {

    app.get('/', function(req, res) {
        res.send('Hello World!!!');
    });

    app.get('/doc', function (req, res) {
        res.render('doc');
    });

    var redirectRoute = function(req, newRoute) {
        return new Promise((resolve, reject) => {
            var url = req.protocol + '://' + req.get('host') + newRoute;
            request(req.method, url)
            .set(req.headers || {})
            .send(req.body || {})
            .query(req.query || {})
            .end((err, res) => {
                if (err) reject(err);
                resolve(res.body);
            });
        });
    };

    var restApiRoot = app.get('restApiRoot');
    app.get(restApiRoot + '/feeds', function(req, res) {
        var feeds = {
            count: 0,
            types: []
        };
        Promise.all(Object.keys(FeedTypes).map((feedTypeKey) => {
            return redirectRoute(req, `${restApiRoot}/feeds/${FeedTypes[feedTypeKey]}/filtered`)
            .then((body) => {
                return {body, feedTypeKey};
            });
        }))
        .then((responses) => {
            for (var response of responses) {
                if (response.body.length > 0) {
                    var feedType = FeedTypes[response.feedTypeKey];
                    feeds.count += response.body.length;
                    feeds.types.push(feedType);
                    feeds[feedType] = response.body;
                }
            }
            res.status(200).send(feeds);
        }, err => res.status(err.status).send(err.response));
    });

};
