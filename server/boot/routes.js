'use strict';

var bodyParser = require('body-parser');
var loopback = require('loopback');
var FeedTypes = require('../../common/utils/feed-types');

module.exports = (app) => {

    app.get('/', (req, res) => {
        res.send('Hello World!!!');
    });

    app.get('/doc', (req, res) => {
        res.render('doc');
    });

    let restApiRoot = app.get('restApiRoot');
    app.get(restApiRoot + '/feeds', (req, res) => {
        let feeds = {
            count: 0,
            types: []
        };
        new Promise((resolve, reject) => {
            app.models.AccessToken.findForRequest(req, (err, token) => {
                if (err) reject(err);
                resolve(token);
            });
        })
        .then((accessToken) => {
            if (!accessToken) return res.status(401).end();
            return Promise.all(Object.keys(FeedTypes).map((feedTypeKey) => {
                let feedType = FeedTypes[feedTypeKey];
                let feedModelName = FeedTypes.getModelName(feedType);
                return app.models[feedModelName].filteredFind({}, {accessToken})
                .then(body => ({body, feedType}), () => ({body: null}));
            }))
            .then((responses) => {
                for (let response of responses) {
                    if (response.body && response.body.length > 0) {
                        feeds.count += response.body.length;
                        feeds.types.push(response.feedType);
                        feeds[response.feedType] = response.body;
                    }
                }
                res.status(200).json(feeds);
            }, err => res.status(err.status).json(err.response));
        });
    });

    let checkAccessTokenIsAdmin = (accessToken) => {
        return new Promise((resolve, reject) => {
            app.models.HubRole.isInRole('admin', {accessToken}, (err, isInRole) => {
                if (err) reject(err);
                resolve(isInRole);
            });
        });
    };

    let getErrorResponse = (err) => {
        return Object.assign({}, err, {message: err.message});
    };

    app.use(restApiRoot + '/feeds', bodyParser.json());
    app.post(restApiRoot + '/feeds', (req, res) => {
        if (!req.body) {
            let err = new Error('Body can\'t be empty');
            err.name = 'Validation error';
            err.status = err.statusCode = 422;
            return res.status(err.status).json(getErrorResponse(err));
        }
        new Promise((resolve, reject) => {
            app.models.AccessToken.findForRequest(req, (err, token) => {
                if (err) reject(err);
                resolve(token);
            });
        })
        .then(accessToken => checkAccessTokenIsAdmin(accessToken))
        .then((isAdmin) => {
            if (!isAdmin) return res.status(401).end();
            if (!Array.isArray(req.body) || req.body.length === 0) {
                let err = new Error('Body must be a non-empty array');
                err.name = 'Validation error';
                err.status = err.statusCode = 422;
                return res.status(err.status).json(getErrorResponse(err));
            }
            let addedFeeds = {};
            return Promise.all(req.body.map((feed, feedIndex) => {
                let feedTypeObj = FeedTypes.getFeedType(feed);
                let feedType = feedTypeObj.type;
                let feedModelName = FeedTypes.getModelName(feedType);
                let FeedModel = app.models[feedModelName];
                let fields = null;
                if (feedTypeObj.key) {
                    fields = feed[feedTypeObj.key];
                    delete feed[feedTypeObj.key];
                    if (!Array.isArray(fields)) fields = [fields];
                }
                let validate = false;
                if (feed.hasOwnProperty('validate')) {
                    validate = feed.validate;
                    delete feed.validate;
                }
                return FeedModel.create(feed)
                .then((feedInstance) => {
                    if (!addedFeeds[feedModelName]) addedFeeds[feedModelName] = [];
                    addedFeeds[feedModelName].push(feedInstance.getId());
                    let feedInstanceP = Promise.resolve();
                    if (fields) {
                        feedInstanceP = Promise.all(fields.map((field, fieldIndex) => {
                            return feedInstance[feedTypeObj.key].create(field)
                            .catch((err) => {
                                err.message = `On creating field ${fieldIndex}: ${err.message}`;
                                return Promise.reject(err);
                            });
                        }));
                    }
                    return feedInstanceP
                    .then(() => {
                        if (validate) {
                            return FeedModel.validate(feedInstance.getId());
                        }
                    })
                    .then(() => feedInstance.toJSON())
                    .catch((err) => {
                        err.message = `On creating feed ${feedIndex}: ${err.message}`;
                        return Promise.reject(err);
                    });
                });
            }))
            .catch((err) => {
                // Delete all inserted feeds
                let promisesArray = [];
                for (let feedModelName in addedFeeds) {
                    promisesArray.push(Promise.all(addedFeeds[feedModelName].map((feedIdToDelete) => {
                        return app.models[feedModelName].deleteById(feedIdToDelete);
                    })));
                }
                return Promise.all(promisesArray)
                .then(() => Promise.reject(err));
            });
        })
        .then(response => res.status(200).json(response))
        .catch(err => res.status(500).json(err));
    });

};
