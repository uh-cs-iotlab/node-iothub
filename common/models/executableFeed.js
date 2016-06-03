'use strict';

var request = require('request');
var assert = require('assert');
var FeedTypes = require('../utils/feed-types');
var vmContainer = require('../../lib/vm-container');
var app = require('../../server/server');

var processors = require('../../lib/processors');
var mappers = require('../../lib/mappers');
var reducers = require('../../lib/reducers');


module.exports = function (ExecutableFeed) {

    ExecutableFeed.mixin('BaseFeed', {type: FeedTypes.EXECUTABLE});

    /**
     * Check datasource definitions , and return a Promise for each data set.
     * Data may be inline, piece, local or remote. Inline and piece datasets are already
     * 'plotted' datasets, in that the data is already available in the datasource description.
     * Local and remote types imply that the data needs to fetched either from local or remote
     * locations, respectively. Remote data may be fetched from any URL.
     * @param  {[type]} element [description]
     * @param  {[type]} index   [description]
     * @param  {[type]} array   [description]
     * @return {[type]}         [description]
     */
    var getData = function (element, index, array) {
        if (element.type) {
            if (element.type === 'inline' || element.type === 'piece') {
                this.data.push(element);
            }
            // Doesn't work yet, used for getting data from defined executable
            // feed data argument descriptions.
            // else if (element.type === 'feed') {
            //     element.data = formatData(element);
            //     {name:element.name, data:formatData(this.feed.data)}
            //     this.data.push(element);
            // }
            else if (element.type === 'local' || element.type === 'remote') {
                var response = fetchFeed(element).then((elem) => {
                    elem.data = formatData(elem);
                    return elem;
                });
                this.data.push(response);
                
            } else {
                throw new Error('Type ' + element.type + ' not supported');
            }
        } else {
            throw new Error('Type must be provided for data');
        }
    };

    /**
     * Returns an array of Promises, where each one is an entry in the data source
     * argument given in request body. After the promise array has the data ready,
     * the data is made available to the script that is to be executed.
     * @param  {[type]} body [description]
     * @param  {[type]} feed [description]
     * @return {[type]}      [description]
     */
    var getAllData = function (body, feed) {
        var context = {
            data: []
        };

        // If data sources for the feed are defined, fetch data and
        // make it available to the script.
        if (body.data || feed.data) {
            context.feed = feed;
            try {
                var source = body.data || feed.data;
                // Save data to context object
                source.forEach(getData, context);
            } catch (error) {
                return Promise.reject(error);
            } 
            return Promise.all(context.data).then(values => {
                if (values) {
                    var contextObj = {data:{}};
                    values.forEach(mapFeeds, contextObj);
                    contextObj.feed = feed;
                    return Promise.resolve(contextObj);
                } else {

                }
            }, err => {
                return Promise.reject(err);
            });
        } else {
            return Promise.resolve({feed: feed});
        }
    }

    /**
     * Check type argument against different http content types, and returns true or false
     * depending on if the content is binary data or not
     * @param  {[type]}  type [description]
     * @return {Boolean}      [description]
     */
    var isBinaryType = function (type) {
        var isBinary = false;

        switch (type) {
            case 'application/octet-stream':
            case 'image/jpeg':
            case 'image/gif':
            case 'image/png':
                isBinary = true;
                break;
            default:
                isBinary = false;
                break;
        }
        return isBinary;
    }

    /**
    * Fetches data from iot feeds, local or remote. The data is then made available for the scripts to be used.
    * @param  {Object} element [description]
    * @return {Object}         [description]
    */
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
        }

        // If request is for plain binary data, do not process it in any way
        if (isBinaryType(element.contentType)) {
            options.encoding = null;
        }
        return new Promise((resolve, reject) => {
            // Allow self-signed certs
            if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
            }

            request(options, function (error, response, body) {
                if (error) {
                    reject(error);
                } else if (response.statusCode !== 200 && response.statusCode !== 0) {
                    var err = new Error('Could not fetch defined data for feed : ' 
                        + element.name);
                    err.name = 'Data Error';
                    err.statusCode = err.status = response.statusCode;
                    reject(err);
                } else {
                    element.data = body;
                    element.type = 'inline';
                    resolve(element);
                }
            });
        });
    };

    /**
     * Formats data for the executing scripts
     * @param  {[type]} elem [description]
     * @return {[type]}      [description]
     */
    var formatData = function (elem) {
        var response;

        switch (elem.contentType) {
            case 'application/octet-stream':
                response = new Buffer(elem.data);
                break;
            case 'image/gif':
            case 'image/png':
            case 'image/jpeg':
                response = new Buffer(elem.data);
                break;
            case 'text/plain':
                response = elem.data;
                break;
            case 'application/json':
            case 'application/javascript':
            case undefined:
            default:
                // JSON.parse() the data?
                response = elem.data;
                break;
        }

        if (elem.type === 'inline' && elem.processors && processors.get(elem.processors)) {
            response = processors.get(elem.processors)(response);
        }

        return response;
    }

    /**
     * Make an object where each data element is accessible by its name.
     * @param  {[type]} element [description]
     * @param  {[type]} index   [description]
     * @param  {[type]} array   [description]
     * @return {[type]}         [description]
     */
    var mapFeeds = function (element, index, array) {
        this.data[element.name] = element.data;
    }

    /**
     * Initializes a vm and executes the script in that environment
     * @param  {[type]} body      [description]
     * @param  {[type]} vmContext [description]
     * @return {[type]}           [description]
     */
    var executeScript = function (body, vmContext) {
        var script = body.source;
        var vmName = body.vm || 'iothub';
        var vmOptions = {
            XMLHttpRequest: true,
            data: vmContext.data,
            lib: vmContext.feed.lib
        }

        return new Promise((resolve, reject) => {
            var context = {}
              , options = {}
            // Get vm instance
            var vm = vmContainer.createVM(vmName, vmOptions);
            context.start = new Date().getTime();
            vm.runScript(script, (err, res) => {
                if (err) {
                    reject(err)
                }
                context.end = new Date().getTime();
                console.log('Execute time: ' + (context.end-context.start)/1000)
                resolve({res:res, context:context, data:vmContext.data});
            });
        });
    }

    /**
     * Formats result according to options argument
     * @param  {[type]} result  [description]
     * @param  {[type]} options [description]
     * @param  {[type]} context [description]
     * @return {[type]}         [description]
     */
    var formatResponse = function (result, options, context) {
        if (options) {
            // Run processor functions before final formatting is done
            if (options.postProcessing) {
                if (typeof options.processors === 'string' &&  processors.get(options.processors)) {
                    result = processors.get(options.processors)(result);
                } else if (Array.isArray(options.processors)) {
                    // NOTE! CHANGE TO MODIFY RESULTS SEQUENTIALLY, now just processes same data over and over.
                    // so can't use array of processors properly yet.
                    options.processors.forEach(function (item, index, arr) {
                        if (typeof item === 'string' && processors.get(item)) {
                            result = processors.get(item)(result);
                        } else {
                            throw new Error('Response processors must be specified as strings');
                        }
                    });
                } else if (options.processors) {
                    throw new Error('Unsupported processor type');
                }
            }

            if (options.metadata) {
                // If metadata is desired with the response, return it. Defaults to
                // plain result object
                return {
                    time: context.end - context.start,
                    result: result,
                    contentType: 'application/json',
                    pieceResult: options.pieceResult || false,
                    postProcessing: options.postProcessing
                }
            } else if (options.contentType) {
                return {
                    contentType: options.contentType,
                    result: result,
                    pieceResult: options.pieceResult || false,
                    postProcessing: options.postProcessing
                }
            } else {
                return {
                    contentType: 'application/json',
                    result: result,
                    pieceResult: options.pieceResult || false,
                    postProcessing: options.postProcessing
                }
            }
        } else {
            return {
                result: result,
                postProcessing: false,
                pieceResult: false,
                contentType: 'application/json'
            }
        }
    }

    /**
     * Registrates a library module to the feed. After registration, the module is available for
     * executing scripts in the 'lib' variable.
     * @param  {[type]}   modelId [description]
     * @param  {[type]}   libName [description]
     * @param  {[type]}   body    [description]
     * @param  {Function} cb      [description]
     * @return {[type]}           [description]
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

    /**
     * Send a script for execution, dataPiece is a piece of the whole data. This function assumes 
     * that this-object refers to the original request object that was posted to this node.
     * @param  {[type]} dataPiece [description]
     * @param  {[type]} index     [description]
     * @param  {[type]} array     [description]
     * @return {[type]}           [description]
     */
    var sendPiece = function (dataPiece, index, array) {
        var req = this;
        var url;
        if (req.body.distribution.nodes && req.body.distribution.nodes[index]) {
            url = req.body.distribution.nodes[index].url;
        } else {
            // Should use a node url given by a metahub, throws an error for now.
            var err = new Error(`No URLs were defined for distributed data. Define a url component 
                for each node in the distribution definition.`);
            err.name = 'InvalidArgumentError';
            err.status = 400;
            return Promise.reject(err);
        }

        // Set first data item to refer to this piece of data. This overrides the whole data that is
        // saved in the first index, and this is the desired effect. The first index should be used 
        // for data that needs to be distributed.
        req.body.data[0] = dataPiece;

        var options = {
            method: req.method,
            url: url,
            json: true,
            body: req.body
        }
        let s = new Date().getTime();
        return new Promise((resolve, reject) => {
            // Allow self-signed certs
            if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
            }
            console.log('Sending piece ' + index);
            request(options, function (error, response, body) { 
                let e = new Date().getTime();
                console.log('Getting piece ' + index + ' : ' + (e-s)/1000);
                if (error === null && response.statusCode !== 200) {
                    error = new Error('Could not execute script piece: ' + body.error.message);
                    error.name = 'ExecutionError';
                    error.status = 400;
                    reject(error);
                } else if (error) {
                    reject(error);
                } else {
                    let res = {
                        result: body,
                        pieceId: dataPiece.pieceId
                    }
                    resolve(res);
                }
            });
        });
    }

    /**
     * Takes a data element and node count as arguments, and divides the given array to an array of subarrays
     * @param  {[type]} elem    [description]
     * @param  {[type]} options [description]
     * @return {[type]}         [description]
     */
    var defaultMapper = function (elem, options) {

        if (!Array.isArray(elem.data)) {
            var err = new Error('Data error: argument must be a valid Array');
            err.status = 400;
            throw err;
        }
        var arr = elem.data;
        options = options || {}

        var ret = []
          , len = arr.length
          , obj = null
          , tmpArr = []
          , nodeCount = options.nodeCount || options.nodes.length

        var pieceLength = Math.floor(len/nodeCount);

        for (let i = 1, j = 1; i <= len; i++) {
            // Check that ? and that this is not the last piece of input array. 
            // Last piece will also include any remaining data in array. Thus, it would be 
            // best to have data such that: dataLength mod nodeCount would be close to 0. Otherwise the last piece
            // will have a lot of additional data, and takes longer than other nodes.
            if (i % pieceLength === 0 && j !== nodeCount) {
                tmpArr.push(arr[i-1]);
                obj = {
                    name: data.name,
                    type: 'piece',
                    pieceId: j,
                    data: tmpArr
                }
                ret.push(obj);
                tmpArr = [];
                j++; // increase piece id
            } else {
                tmpArr.push(arr[i-1]);
                // if this is the last index of array, push 
                if (i === len) {
                    obj = {
                        name: data.name,
                        type: 'piece',
                        pieceId: j,
                        data: tmpArr
                    }
                    ret.push(obj);
                }
            }
        }
        return ret;
    }

    /**
     * Returns encoding depending on the contentType argument. Images and plain binary data
     * have 'binary' encoding, json and javascript utf-8. Returns false if contentType does not match 
     * any choices.
     * @param  {[type]} contentType [description]
     * @return {[type]}             [description]
     */
    var getEncoding = function (contentType) {
        var encoding = false;

        switch (contentType) {
            case 'application/octet-stream':
            case 'image/gif':
            case 'image/png':
            case 'image/jpeg':
                encoding = 'binary';
                break;
            case 'application/json':
            case 'application/javascript':
                encoding = 'utf8';
                break;
            default:
                encoding = false;
                break;
        }
        return encoding;
    }

    /**
     * Get data according to data source description, and distribute it to pieces
     * @param  {[type]} body    [description]
     * @param  {[type]} feed    [description]
     * @param  {[type]} options [description]
     * @return {[type]}         [description]
     */
    var getDistributableData = function (body, feed, options) {
        let d = body.data || feed.data;
        // NOTE! Distributable data should be the first object in the array.
        let dataSource = d[0];
        if (!dataSource) {
            let err = new Error('Could not find distributable data');
            return Promise.reject(err);
        }

        var convergedData = dataSource.type === 'inline' ? Promise.resolve(dataSource) : fetchFeed(dataSource);

        return convergedData.then((data) => {
            // Takes care of processing data as needed before mapping
            data.data = formatData(data);

            var mapperFunction;

            // Call mapper function
            switch (typeof body.distribution.mapper) {
                case 'string':
                    if (mappers.get(body.distribution.mapper)) {
                        return mappers.get(body.distribution.mapper)(data, options);
                    } else if (feed.lib[body.distribution.mapper]) {
                        return feed.lib[body.distribution.mapper](data, options);
                    } else {
                        let err = new Error('Specified mapper function not found');
                        err.status = 404;
                        throw err;
                    }
                    break;
                case 'function':
                    try {
                        return body.distribution.mapper(data, options);
                    } catch (err) {
                        let err = new Error('Error executing custom mapper: ' + err.message);
                        err.status = 404;
                        throw err;   
                    }
                    break;
                case undefined:
                default:
                    return defaultMapper(data, options);
                    break;
            }
        });
    }

    /**
     * Run the reducer function for the response pieces of data. 
     * @param  {[type]} feed    [description]
     * @param  {[type]} values  [description]
     * @param  {[type]} options [description]
     * @return {[type]}         [description]
     */
    var runReducer = function (feed, values, options) {
        if (typeof options.reducer === 'function') {
            return options.reducer(values);
        } else if (typeof options.reducer === 'string') {
            if (reducers.get(options.reducer)) {
                return reducers.get(options.reducer)(values);
            } else if (feed.lib && feed.lib[options.reducer]) {
                return feed.lib[options.reducer](values);
            } else {
                let err = new Error('Reducer not found.');
                err.name = 'FunctionNotFoundError';
                throw err;
            }
        } else {
            throw new TypeError('Reducer must be either string of function.');
        }
    }

    /**
     * Default reducer function for combining response pieces. Maybe needs to be moved to reducers
     * library.
     * @param  {[type]} values [description]
     * @return {[type]}        [description]
     */
    var defaultReducer = function (values) {
        assert.ok(Array.isArray(values), "argument 'values' must be a valid array.");

        var arr = [];
        for (let item of values) {
            if (item.result) {
                arr.push(item.result);
            } else {
                let err = new Error('Invalid piece of data for reducer: Item does not have argument result.');
                err.name = 'InvalidPieceResponseError';
                throw err;
            }
        }
        return {response: arr}
    }

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
        var body = req.body;
        var reqP;

        if (!body.source) {
            let err = new Error("The request body is not valid. Details: 'script' can't be blank");
            err.name = 'Validation Error';
            err.statusCode = err.status = 422;
            return cb(err);
        }

        // Sequence to handle request:
        // - check distribution param, and send request further if needed
        // - if script is run in this node, fetch data and library dependencies, then execute script
        reqP = ExecutableFeed.findById(modelId)
            .then((feed) => {
                let ss = new Date().getTime();
                console.log('START');
                if (!feed) {
                    let err = new Error(`Feed not found.`);
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

                    // Chech distribution parameter, and either distribute and send data further,
                    // or handle in this node.
                    body.currentDepth = body.currentDepth || 0;
                    // console.log('distribute', body.currentDepth, distributeOptions)
                    if (distribute && (body.currentDepth < distributeOptions.maxDepth)) {
                        let s = new Date().getTime();
                        return getDistributableData(body, feed, distributeOptions).then((pieces) => {
                            let d = new Date().getTime();
                            console.log('Getting data + mapping: ' + (d-s)/1000);
                            // Increase depth counter for next level
                            body.currentDepth++;
                            // Wait all the pieces to return responses, which may only be ACKs, or full
                            // responses.
                            return Promise.all(pieces.map(sendPiece, req)).then((values) => {
                                let p = new Date().getTime();
                                console.log('Getting all responses: ' + (p-d)/1000)
                                // Do something with the values..
                                // console.log('values', values)
                                if (values && values[0] && values[0].result.error) {
                                    let err = new Error('Error running distributed code: ' + values[0].result.error.message);
                                    throw err;
                                }
                                let options = body.response;
                                let reducedResult;
                                options.postProcessing = true;
                                if (distributeOptions.reducer) {
                                    try {
                                        let reducerStart = new Date().getTime();
                                        reducedResult = runReducer(feed, values, distributeOptions);
                                        let reducerEnd = new Date().getTime();
                                        console.log('Reducer runtime: ' + (reducerEnd-reducerStart)/1000);
                                        console.log('Total time: ' + (reducerEnd-s)/1000);
                                        return Promise.resolve(formatResponse(reducedResult.result, options));
                                    } catch (err) {
                                        let error = new Error('Failed to run reducer: ' + err.message);
                                        error.status = 400;
                                        error.name = 'ReducerExecutionError';
                                        return Promise.reject(err);
                                    }
                                } else {
                                    reducedResult = defaultReducer(values);
                                    return Promise.resolve(formatResponse(reducedResult, options));
                                }
                            }, err => Promise.reject(err));
                        });    
                    } else {
                        let s = new Date().getTime();
                        return getAllData(body, feed).then((context) => {
                            // Now we have ready context object with data and libraries fetched. Next we execute
                            // the script and return response. 
                            let d = new Date().getTime();
                            console.log('Getting data: ' + (d-s)/1000);
                            return executeScript(body, context).then(rawResult => {
                                let options = body.response;
                                if (distribute && body.response.processors) {
                                    // If we are executing in a leaf node, don't run processors on data.
                                    // They are run after reducers in parent nodes.
                                    options.postProcessing = false;
                                    // Indicate that this is an intermediate result
                                    options.pieceResponse = true;
                                    // Set content type to binary data, so original content-type
                                    // is ignored for distributed piece results. This is needed
                                    // so that data is not needlessly processed.
                                    options.contentType = 'application/json';
                                } else {
                                    options.postProcessing = true;
                                }
                                let res = formatResponse(rawResult.res, options, rawResult.context);
                                let e = new Date().getTime();
                                console.log('Getting data + execute time: ' + (e-s)/1000);
                                return res;
                            }, err => Promise.reject(err));         
                        });
                    }
                }
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

    ExecutableFeed.afterRemote('runScript', function(context, remoteMethodOutput, next) {
        if (context.req.headers.accept && context.req.headers.accept === 'text/plain') {
            context.res.setHeader('Content-Type', context.req.headers.accept);
            context.res.end(JSON.stringify(remoteMethodOutput.result) + '');
        } else if (remoteMethodOutput.contentType) {
            let encoding = getEncoding(remoteMethodOutput.contentType);
            if (encoding === 'binary') {
                context.res.setHeader('Content-Type', remoteMethodOutput.contentType);
                context.res.end(remoteMethodOutput.result, encoding);
            } else if (encoding === 'utf8') {
                context.result = remoteMethodOutput.result;
                next();
                // context.res.setHeader('Content-Type', remoteMethodOutput.contentType);
                // context.res.end(remoteMethodOutput.result, encoding);
            } else if (remoteMethodOutput.contentType === 'text/plain') {
                context.res.setHeader('Content-Type', remoteMethodOutput.contentType);
                context.res.end(JSON.stringify(remoteMethodOutput.result) + '');
            } else {
                next();
            }
        } else {
            next();
        }
    });

    ExecutableFeed.beforeRemote('registerLib', function(context, unused, next) {
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
};
