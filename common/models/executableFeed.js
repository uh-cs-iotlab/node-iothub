'use strict';

var request = require('request');
var FeedTypes = require('../utils/feed-types');
var app = require('../../server/server');
var logger = require('../utils/logger');
var profiler = require('../lib/profiler');
var Helper = require('../utils/executable-feed-helper');
var helpers = new Helper();

module.exports = function (ExecutableFeed) {

    ExecutableFeed.mixin('BaseFeed', {type: FeedTypes.EXECUTABLE});

    // initialize execution counter
    let executionId = 1;
    profiler.clearAll();

    /**
     * Registrates a library module to the feed. After registration, the module is available for
     * executing scripts in the 'lib' variable.
     * @param  {string}   modelId ModelId of the executable feed
     * @param  {string}   libName Name of the added library
     * @param  {object}   body    Request body
     * @param  {Function} cb      Callback function
     * @return {object}           A Promise object that is either rejected with an error, or resolved and
     *                            includes the updated libraries object.
     */
    ExecutableFeed.registerLib = function (modelId, libName, body, cb) {

        if (!body.source) {
            var err = new Error("The request body is not valid. Details: 'script' can't be blank");
            err.name = 'Validation Error';
            err.statusCode = err.status = 422;
            reqP = Promise.reject(err);
        }

        var reqP = ExecutableFeed.findById(modelId)
            .then((feed) => {
                if (!feed) {
                    var err = new Error(`Feed not found.`);
                    err.statusCode = err.status = 404;
                    return Promise.reject(err);
                } else {
                    var libs = feed.lib;
                    if (libs[libName]) {
                        libs[libName].description = body.description || libs[libName].description || '';
                        libs[libName].source = body.source || libs[libName].source || '';
                    } else {
                        libs[libName] = {
                            name: libName,
                            description: body.description || '',
                            source: body.source || ''
                        };
                    }
                    feed.updateAttribute('lib', libs)
                    .then((result) => {
                        if (!result) {
                            var err = new Error(`Could not update feed property.`);
                            err.statusCode = err.status = 400;
                            return Promise.reject(err);
                        }
                        return Promise.resolve(result);
                    })
                }
            });
        if (cb) reqP.then(result => cb(null, result), err => cb(err));
        return reqP;
    }
    ExecutableFeed.remoteMethod(
        'registerLib',
        {
            description: 'Register a library script on executable feed by id',
            accessType: 'WRITE',
            accepts: [
                {arg: 'id', type: 'string', required: true},
                {arg: 'name', type: 'string', required: true},
                {arg: 'body', type: 'object', http: {source: 'body'}}
            ],
            returns: {type: 'string', root: true},
            http: {verb: 'post', path: '/:id/lib/:name'}
        }
    );

    ExecutableFeed.beforeRemote('registerLib', function(context, unused, next) {
        // If plain text script is posted, modify request to be json for remote method.
        // Possibly also validate script here.
        if (context.req.headers['content-type'] === 'text/plain') {
            let tmpBody = {
                source: context.req.body
            }
            context.body = context.req.body = context.args.body = tmpBody;
            context.req.headers['content-type'] = context.req.rawHeaders['Content-Type'] = 'application/json';
        }
        next();
    });

    /**
     * Runs the whole script execution flow. Gets data from data descriptions and makes it available
     * to the script. Also, checks if data needs to be distributed (mapped) and shared to other nodes for executions,
     * and if responses need to be combined together (reduced). After this function has executed, the 'afterRemote' hooks may
     * still modify the response. 
     * @param  {[type]}   modelId [description]
     * @param  {[type]}   req     [description]
     * @param  {Function} cb      [description]
     * @return {[type]}           [description]
     */
    ExecutableFeed.runScript = function (modelId, req, cb) {
        let body = req.body;
        let reqP;
        let responseOptions = body.response || {};
        let profilerOptions = body.profiler || {};

        // Clear all previous logs from profiler
        profiler.clearAll();
        profiler.start();

        if (!body.source) {
            let err = new Error("The request body is not valid. Details: 'script' can't be blank");
            err.name = 'Validation Error';
            err.statusCode = err.status = 422;
            return cb(err);
        }

        // Sequence to handle request:
        // 1. Check distribution param, and send request further if needed
        // 2. If script is run in this node, get/fetch data and library dependencies, then execute script
        reqP = ExecutableFeed.findById(modelId)
            .then((feed) => {
        		return helpers.logProfile({tag:'feed_fetched'}).then(success => {
	                if (!feed) {
	                    let err = new Error(`Feed not found: ` + modelId);
	                    err.statusCode = err.status = 404;
	                    return Promise.reject(err);
	                } else {
	                    let distribute, distributeOptions;
	                    if (body.distribution && body.distribution.enabled) {
                            distribute = true;
                            distributeOptions = body.distribution;
	                    } else if (feed.distribution && feed.distribution.enabled) {
	                        distribute = true;
	                        distributeOptions = feed.distribution;
	                    }  else {
	                        distribute = false;
	                        distributeOptions = undefined;
	                    }

	                    console.log('arrived: ', new Date());
	                    // Check distribution parameter, and either distribute and send data further,
	                    // or handle in this node.
	                    body.currentDepth = body.currentDepth || 0;
                        if (distribute && (body.currentDepth < distributeOptions.maxDepth)) {
	                        return helpers.getDistributableData(body, feed, distributeOptions).then((pieces) => {
	                            // Each piece is a definition of a piece of the original data. The definition may already
                                // include fetched and distributed data, or only a url for getting a piece of data.
                                return helpers.logProfile({tag:'after_data_map'}).then(success => {
		                            let thisLevel = body.currentDepth;
                                    body.currentDepth++;
                                    console.time('stringify')
		                            let strCopyOfBody = JSON.stringify(req.body);
                                    console.timeEnd('stringify')
                                    return Promise.all(pieces.map(helpers.sendPiece, strCopyOfBody)).then((values) => {
                                        return helpers.logProfile({tag:'dist_response_latency'}).then(success => {
			                                if (values && values[0] && values[0].result && values[0].result.error) {
			                                    let msg = 'Error running distributed code: ' + values[0].result.error.message;
			                                    logger.error(msg);
			                                    let err = new Error(msg);
			                                    return Promise.reject(err);
			                                } else if (values && values[0] == null) {
                                                let err = new Error('Error: No data received after mapper');
                                                return Promise.reject(err);
                                            }

                                            let reducedResult;
                                            if (thisLevel === 0) {
                                                responseOptions.postProcessing = true;
                                            } else {
                                                responseOptions.postProcessing = false;
                                                responseOptions.pieceResult = true;
                                                responseOptions.contentType = 'application/json';
                                            }
                                            if (distributeOptions.reducer) {
                                                try {
                                                    if (profilerOptions.enabled && !app.get('profiler')) {
                                                        throw new Error('Profiler data requested, but hub is not configured to produce it. Use --profiler option when tarting the hub');
                                                    }
                                                    reducedResult = helpers.runReducer(feed, values, distributeOptions);
                                                    return helpers.logProfile({tag:'after_reducer'}).then((success) => {
                                                        let res;
                                                        if (profilerOptions.enabled) {
                                                            responseOptions.profiler = profilerOptions;
                                                            res = helpers.formatResponse(reducedResult.result, responseOptions, reducedResult.profilerData);
                                                            res.profiler.piecesData = reducedResult.profilerData;
                                                            res.profiler.data = profiler.all();
                                                        } else {
                                                            res = helpers.formatResponse(reducedResult.result, responseOptions, {});
		                                        		}
		                                        		return helpers.logProfile({tag:'before_sending_response'}).then(success => {
		                                        			return res;
		                                        		});
		                                        	});
                                                } catch (err) {
                                                    logger.error(err.message);
                                                    err.message = 'Failed to run reducer: ' + err.message;
                                                    err.status = 400;
			                                        err.name = 'ReducerExecutionError';
			                                        return Promise.reject(err);
			                                    }
			                                } else {
			                                	// TODO: test this, add profilerData
			                                 //    reducedResult = reducers.defaultReducer(values);
			                                 //    let res = Promise.resolve(helpers.formatResponse(reducedResult, responseOptions));
			                                	// return helpers.logProfile({tag:'before_sending_response'}).then(success => {
			                                	// 	return res;
			                                	// });
                                                return Promise.reject(new Error('Default reducer function is not implemented. Use imageReducer.'));
			                                }
			                            }, err => Promise.reject(err));
		                            }, err => Promise.reject(err));
								}, err => Promise.reject(err));
	                        });
                        } else {
                            // No distribution, execute locally
                            return helpers.getAllData(body, feed).then((context) => {
                                // Now we have ready context object with data and libraries fetched. Next we execute
                                // the script and return response. 
                                return helpers.logProfile({tag:'after_data_fetch'}).then(success => {
                                    console.log('before exec at:', new Date(), context.data)
                                    return helpers.executeScript(body, context).then(rawResult => {
		                                if (distribute && body.response.processors) {
		                                    // If executing in a leaf node, don't run post processors on data.
		                                    // They are run after reducers in parent nodes.
		                                    responseOptions.postProcessing = false;
		                                    // Indicate that this is an intermediate result
		                                    responseOptions.pieceResult = true;
		                                    responseOptions.contentType = 'application/json';
		                                } else {
		                                    responseOptions.postProcessing = true;
		                                }
                                        if (profilerOptions && profilerOptions.enabled) {
                                            responseOptions.profiler = profilerOptions;
                                        }
                                        return helpers.logProfile({tag:'before_sending_response'}).then(success => {
			                                console.log('after exec at:', new Date())
                                            var r =  helpers.formatResponse(rawResult.res, responseOptions, rawResult.context);
                                            console.log('after format at:', new Date())
                                            return r;
		                            	}, err => Promise.reject(err));
		                            }, err => Promise.reject(err));
								}, err => Promise.reject(err));

	                        });
	                    }
	                }
	        	}, err => Promise.reject(err));
        	});

        if (cb) reqP.then(result => {
            cb(null, result);
        }, err => cb(err));
        return reqP;
	    
    };
    ExecutableFeed.remoteMethod(
        'runScript',
        {
            description: 'Run a script on executable feed by id',
            accessType: 'EXECUTE',
            accepts: [
                {arg: 'id', type: 'string', required: true},
                {arg: 'req', type: 'object', http: {source: 'req'}}
            ],
            returns: {type: 'string', root: true},
            http: {verb: 'post', path: '/:id/run', status: 200, errorStatus: 400}
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

    ExecutableFeed.afterRemote('runScript', function(context, executionOutput, next) {
        console.log('afterRemote 1 at:', new Date())
        if (context.req.headers.accept && context.req.headers.accept === 'text/plain') {
            context.res.setHeader('Content-Type', context.req.headers.accept);
            context.res.end(JSON.stringify(executionOutput.result) + '');
        } else if (executionOutput.contentType) {
            let encoding = helpers.getEncoding(executionOutput.contentType);
            if (encoding === 'binary') {
                console.log('afterRemote at binary:', new Date())
                context.res.setHeader('Content-Type', executionOutput.contentType);
                context.res.end(executionOutput.result, encoding);
            } else if (encoding === 'utf8') {
            	// If profiling info wanted, return only profiler data
            	if (executionOutput.profiler && executionOutput.profiler.enabled) {
                	if (executionOutput.pieceResult) {
                        context.result = {
	                		result: executionOutput.result,
	                		profiler: {
	                			enabled: true,
	                			data: profiler.all()
	                		}
	                	}
                        // Include profilerData in the piece response
                        if (executionOutput.profiler.piecesData) {
                            context.result.profiler.piecesData = executionOutput.profiler.piecesData;
                        }

                        console.log('afterRemote at utf-8 1:', new Date(), executionOutput.result.data.length)
                    } else {
	                	// Omit normal response for profiler data
	                	context.result = {
	                		profiler: {
	                			id: executionId++,
	                			timestamp: new Date().getTime(),
	                			data: profiler.all()
	                		}
	                	}
	                	if (executionOutput.profiler.piecesData) {
	                		context.result.profiler.piecesData = executionOutput.profiler.piecesData;
	                	}
                        console.log('afterRemote at utf-8 2:', new Date())
	                }

                	next();
                } else {
                	context.result = {
                		result: executionOutput.result
                	}
                	next();
                }
            } else if (executionOutput.contentType === 'text/plain') {
                console.log('afterRemote 2 at text/plain:', new Date())
                context.res.setHeader('Content-Type', executionOutput.contentType);
                context.res.end(JSON.stringify(executionOutput.result) + '');
            } else {
                next();
            }
        } else {
            next();
        }
    });

};
