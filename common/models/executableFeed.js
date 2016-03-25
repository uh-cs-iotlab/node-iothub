'use strict';

var FeedTypes = require('../../server/feed-types.json');
var iothubvm = require('../../lib/iothub-vm');

module.exports = function (ExecutableFeed) {

    ExecutableFeed.mixin('BaseFeed', {type: FeedTypes.EXECUTABLE});

    ExecutableFeed.runScript = function (modelId, body, cb) {
    	if (!body.source) {
            var err = new Error("The request body is not valid. Details: 'script' can't be blank");
            err.name = 'Validation Error';
            err.statusCode = err.status = 422;
            reqP = Promise.reject(err);
        }

        var script = body.source;
        var vm = iothubvm();
        var reqP = ExecutableFeed.findById(modelId)
            .then((feed) => {
                if (!feed) {
                    var err = new Error(`Feed not found.`);
                    err.statusCode = err.status = 404;
                    return Promise.reject(err);
                } else {
                    return new Promise((resolve, reject) => {
                        var start, end, time;
                        var response = null;
                        start = new Date().getTime();
                        vm.runScript(script, (err, res) => {
                            if (err) reject(err);
                            end = new Date().getTime();
                            response = {
                                time: end - start,
                                result: res,
                                feed: feed.name
                            }

                            resolve(response);
				        });
	        		});
        		}
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
            context.res.end(remoteMethodOutput.result + '');
        } else {
            next();
        }
    });

};
