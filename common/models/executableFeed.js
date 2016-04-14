'use strict';

var request = require('request');
var FeedTypes = require('../utils/feed-types');
var vmContainer = require('../../lib/vm-container');
var app = require('../../server/server');

module.exports = function (ExecutableFeed) {

    ExecutableFeed.mixin('BaseFeed', {type: FeedTypes.EXECUTABLE});

    var getData = function (element, index, array) {
        if (element.type) {
            if (element.type === 'inline') {
                this.data.push(element);
            } else if (element.type === 'feed') {
                this.data.push({name: element.name, data:this.feed.data});
            } else if (element.type === 'local') {
                this.data.push(fetchFeed(element));
            } else if (element.type === 'remote') {
                this.data.push(fetchFeed(element));
            } else {
                throw new Error('Type ' + element.type + ' not supported');
            }
        } else {
            throw new Error('Type must be provided for data');
        }
    };

    var fetchFeed = function (element) {
        var feedId = element.feed || '',
            feedType = element.feedType || 'atomic';

        if (element.type === 'local') {
            // Default settings for local feeds
            var baseUrl = 'https://' + app.get('host') + ':' + app.get('port') + '/api/feeds',
                feedUrl =  baseUrl + '/' + feedType + '/' + feedId,
                url = baseUrl + feedUrl;
        } else if (element.type === 'remote' && element.url) {
            var url = element.url;
        } else {
            var error = new Error(`Type ` + element.type + ` not identified`);
            Promise.reject(error);
        }
            
        var options = {
            method: 'GET',
            uri: url
        };
        return new Promise((resolve, reject) => {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

            request(options, function (error, response, body) {
                if (error) {
                    reject(error);
                } else if (response.statusCode !== 200 && response.statusCode !== 0) {
                    var err = new Error('Could not fetch defined data for feed : ' 
                        + element.name);
                    err.name = 'Data Error';
                    err.statusCode = err.status = response.statusCode;
                    delete err.stack;
                    reject(err);
                } else {
                    resolve({name: element.name, data: JSON.parse(body)}); 
                }
            });
        });
    };

    var mapFeeds = function (element, index, array) {
        this.data[element.name] = element.data;
    }

    ExecutableFeed.runScript = function (modelId, body, cb) {
    	if (!body.source) {
            var err = new Error("The request body is not valid. Details: 'script' can't be blank");
            err.name = 'Validation Error';
            err.statusCode = err.status = 422;
            reqP = Promise.reject(err);
        }

        var script = body.source;
        var vmName = body.vm || 'iothub';
        var context = {
            data: []
        };

        var vmOptions = {
            XMLHttpRequest: true,
            data: {}
        }

        var reqP = ExecutableFeed.findById(modelId)
            .then((feed) => {
                if (!feed) {
                    var err = new Error(`Feed not found.`);
                    err.statusCode = err.status = 404;
                    return Promise.reject(err);
                } else {
                    // If data sources for the feed are defined, fetch data and
                    // make it available to the script.
                    if (body.data) {
                        context.feed = feed;
                        try {
                            body.data.forEach(getData, context);
                        } catch (error) {
                            return Promise.reject(error);
                        } 
                        return Promise.all(context.data)
                        .then(values => {
                            if (values) {
                                var contextObj = {data:{}};
                                values.forEach(mapFeeds, contextObj);
                                contextObj.feed = feed;
                                return Promise.resolve(contextObj);
                            }
                        }, err => {
                            return Promise.reject(err);
                        });
                    } else {
                        // Else just return object with feed info
                        return Promise.resolve({feed: feed});
                    }
                }
            })
            .then((vmContext) => {
                vmOptions.data = vmContext.data;
                return new Promise((resolve, reject) => {
                    var start, end, time;
                    var response = null;
                    var vm = vmContainer.getVM(vmName, vmOptions);

                    start = new Date().getTime();
                    vm.runScript(script, (err, res) => {
                        if (err) reject(err);
                        end = new Date().getTime();
                        // If metadata is desired with the response, return it. Defaults to
                        // plain result object
                        response = (body.response && body.response.metadata) ? {
                            time: end - start,
                            result: res,
                            feed: vmContext.feed.name
                        } : {
                            result: res
                        };
                        resolve(response);
			        });
        		});
        	});

        if (cb) reqP.then(result => cb(null, result), err => cb(err));
        return reqP;
    };
    ExecutableFeed.remoteMethod(
        'runScript',
        {
            description: 'Run a script on executable feed by id',
            accessType: 'EXECUTE',
            accepts: [
                {arg: 'id', type: 'string', required: true},
                {arg: 'body', type: 'object', http: {source: 'body'}}
            ],
            returns: {type: 'string', root: true},
            http: {verb: 'post', path: '/:id/run'}
        }
    );

    ExecutableFeed.beforeRemote('runScript', function(context, unused, next) {
        // If plain text script is posted, modify request to be json for remote method.
        // Possibly also validate script here.
        if (context.req.headers['content-type'] === 'text/plain') {
            var tmpBody = {
                source: context.req.body
            }
            context.body = context.req.body = context.args.body = tmpBody;
            context.req.headers['content-type'] = context.req.rawHeaders['Content-Type'] = 'application/json';
        }
        next();
    });

    ExecutableFeed.afterRemote('runScript', function(context, remoteMethodOutput, next) {
        if (context.req.headers.accept && context.req.headers.accept === 'text/plain') {
            context.res.setHeader('Content-Type', 'text/plain');
            context.res.end(JSON.stringify(remoteMethodOutput.result) + '');
        } else {
            next();
        }
    });

};
