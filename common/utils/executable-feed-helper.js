'use strict'

var os = require('os');
var processors = require('../lib/processors');
var mappers = require('../lib/mappers');
var reducers = require('../lib/reducers');
var request = require('request');
var vmContainer = require('../../lib/vm-container');

var profiler = require('../lib/profiler');
var pusage = require('pidusage');


var profileEvents = require('../utils/profile-events');
var logger = require('../utils/logger');

var app = require('../../server/server');

var Helper = function () {}

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
Helper.prototype.getData = function (element, index, array) {
    if (element.type) {
        if (element.type === 'inline' || element.type === 'piece') {
            return element;
        }
        else if (element.type === 'local' || element.type === 'remote') {
            return Helper.prototype.fetchFeed(element).then((elem) => {
                elem.data = Helper.prototype.preprocessData(elem);
                return elem;
            });
            
        }     
        else {
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
 * @param  {Object} body [description]
 * @param  {Object} feed [description]
 * @return {Object}      [description]
 */
Helper.prototype.getAllData = function (body, feed) {
    var resolvedData;
    var dataSources;

    // If data sources for the feed are defined, fetch data and
    // make it available to the script.
    if (body.data || feed.data) {
        try {
            dataSources = body.data || feed.data;
            resolvedData = dataSources.map(this.getData);
        } catch (error) {
            return Promise.reject(error);
        } 
        return Promise.all(resolvedData).then(values => {
        	if (values) {
                let contextObj = {data:{}};
                let data = {};
                values.forEach(function (elem) { data[elem.name] = elem.data; });
                contextObj.data = data;
                contextObj.feed = feed;
                return Promise.resolve(contextObj);
            } else {
                let err = new Error("Could not get data from defined sources");
                return Promise.reject(err);
            }
        }, (err) => {
            return Promise.reject(err);
        });
    } else {
        return Promise.resolve({feed: feed});
    }
}

/**
* Fetches data from iot feeds, local or remote. The data is then made available for the scripts to be used.
* @param  {Object} element [description]
* @return {Object}         [description]
*/
Helper.prototype.fetchFeed = function (element) {
    var feedId = element.feed || '',
        feedType = element.feedType || 'atomic';
    let url;

    if (element.type === 'feed') {
        // Default settings for local feeds
        var baseUrl = 'https://' + app.get('host') + ':' + app.get('port') + '/api/feeds',
            feedUrl =  baseUrl + '/' + feedType + '/' + feedId
        url = baseUrl + feedUrl;
    } else if (element.type === 'local' && element.url) {
        url = element.url;
    } else {
        var error = new Error(`Type ` + element.type + ` not identified`);
        Promise.reject(error);
    }

    var options = {
        method: 'GET',
        uri: url
    }

    // If request is for plain binary data, do not process it in any way
    if (this.isBinaryType(element.contentType)) {
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
 * Send a script for execution, dataPiece is a piece of the whole data. This function assumes 
 * that this-object refers to the original request object that was posted to this node.
 * @param  {[type]} dataPiece [description]
 * @param  {[type]} index     [description]
 * @param  {[type]} array     [description]
 * @return {[type]}           [description]
 */
Helper.prototype.sendPiece = function (dataPiece, index, array) {
    let req = this;
    // Use copy of request body, so that we don't modify one common object
    let strCopy = JSON.stringify(this.body);
    let body = JSON.parse(strCopy);
    let url;
    if (body.distribution.nodes && body.distribution.nodes[index]) {
        // If this is a nested distribution, the urls in the distribution part of the request must
        // be one level deeper in the nested object. If such level exists, we replace the current highest
        // level of node url definitions with the next level. This continues for each level of distribution.
        // If no next level is defined in the distribution urls, uses the current level. So using bigger
        // maximum depth for execution than there are actually node urls defined results in distributing the 
        // computations over and over to the same nodes!
        if (dataPiece.type === 'piece') {
            // NOTE! Here url definition MUST be before nodes is reassigned
            url = body.distribution.nodes[index].url;
            if (body.distribution.nodes[index].nodes && body.distribution.nodes[index].nodes.length > 0) {
                // When another level of distribution is found
                body.distribution.nodes = body.distribution.nodes[index].nodes;
            } else {
                // No further distribution levels defined for this node
                if (!body.distribution.minDepth || body.distribution.minDepth <= body.currentDepth) {
                    body.distribution.maxDepth = body.currentDepth-1;
                }
                body.distribution.nodes = [body.distribution.nodes[index]];
            }
        } else {
            url = body.distribution.nodes[index].url;
        }
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
    body.data[0] = dataPiece;

    var options = {
        method: 'POST',
        url: url,
        json: true,
        body: body
    }
    console.log('SENDING PIECE', index, options.url, options.body.distribution.nodes, body.currentDepth, body.distribution.maxDepth)
    return new Promise((resolve, reject) => {
        // Allow self-signed certs for dev and test
        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        }
        request(options, function (error, response, responseBody) {
            if (error === null && response.statusCode !== 200) {
                error = new Error('Could not execute script piece: ' + responseBody.error.message);
                error.name = 'ExecutionError';
                error.status = 400;
                reject(error);
            } else if (error) {
                reject(error);
            } else if (!responseBody.result) {
            	reject(new Error('No result retrieved from node: ' + dataPiece.pieceId));
            } else {
            	const contentLength = response.headers['content-length'];
            	// Can't use 'this', because it refers to request object !!!
            	Helper.prototype.logProfile({
            		tag: 'piece_response_latency', 
            		pieceId: dataPiece.pieceId, 
            		contentLength: contentLength
            	}).then(val => {
                    let res = {
                        result: responseBody.result,
                        pieceId: dataPiece.pieceId
                    }
                    if (body.profiler && body.profiler.enabled) {
                    	// If profiler enabled, include profiler data from response
                    	res.profiler = responseBody.profiler;
                    }
                    resolve(res);
                }, err => reject(err));
            }
        });
    });
}


/**
 * Formats response object according to options argument
 * @param  {object} result  [description]
 * @param  {object} options [description]
 * @param  {object} context [description]
 * @return {object}         [description]
 */
Helper.prototype.formatResponse = function (result, options, context) {
    if (options) {
        // Run post processing functions before final formatting is done
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
        if (options.profiler && options.profiler.enabled) {
            // If profiler data is desired with the response, return it. Defaults to
            // plain result object
            if (!app.get('profiler') || !context) {
            	result = new Error('profiler info not available for this node');
            }
            return {
            	profiler: {
            		enabled: !!options.profiler.enabled,
            		data: context,
            		history: !!options.profiler.history
            	},
                result: result,
                contentType: 'application/json',
                pieceResult: options.pieceResult || false,
                postProcessing: false
            }
        } else if (options.contentType) {
            console.log(options)
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
 * Returns encoding depending on the contentType argument. Images and plain binary data
 * have 'binary' encoding, json and javascript utf-8. Returns false if contentType does not match 
 * any choices.
 * @param  {[type]} contentType [description]
 * @return {[type]}             [description]
 */
Helper.prototype.getEncoding = function (contentType) {
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
 * Check type argument against different http content types, and returns true or false
 * depending on if the content is binary data or not
 * @param  {[type]}  type [description]
 * @return {Boolean}      [description]
 */
Helper.prototype.isBinaryType = function (type) {
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
 * Formats data for the executing scripts
 * @param  {[type]} elem [description]
 * @return {[type]}      [description]
 */
Helper.prototype.preprocessData = function (elem) {
    var response;

    // No preprocessing for remote datasources (processed in remote hubs)
    if (elem.type === 'remote') {
    	return elem.data;
    }

    switch (elem.contentType) {
        case 'application/octet-stream':
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
            response = elem.data;
            break;
    }

    // Preprocess the data before using a mapping function. E.g., JSON decoding can be applied. Mapping
    // functions usually expect arrays.
    if (elem.type === 'inline' && elem.processors && processors.get(elem.processors)) {
        response = processors.get(elem.processors)(response);
    }

    return response;
}

/**
 * Get data according to data source description, and distribute it to pieces
 * @param  {[type]} body    [description]
 * @param  {[type]} feed    [description]
 * @param  {[type]} options [description]
 * @return {[type]}         [description]
 */
Helper.prototype.getDistributableData = function (body, feed, options) {
    let d = body.data || feed.data;
    // NOTE! Distributable data should be the first object in the array.
    let dataSource = d[0];
    var convergedData;
    if (!dataSource) {
        let err = new Error('Could not find distributable data');
        return Promise.reject(err);
    }

    if (dataSource.type === 'inline' || dataSource.type === 'remote' || dataSource.type === 'piece') {
    	// Data is ready
    	convergedData = Promise.resolve(dataSource);
    } else if (dataSource.type === 'local') {
    	// Fetch data locally and distribute it to hubs
    	convergedData = this.fetchFeed(dataSource);
    } else {
    	let err = new Error("Invalid type for data source. Supported types are inline, local and remote.");
    	err.status = 400;
    	err.name = "DataSourceValidationError";
    	return Promise.reject(err);
    }

    return convergedData.then((data) => {
        // Takes care of processing data as needed before mapping. If data is already processed, don't process
        if (dataSource.type !== 'piece') {
            data.data = this.preprocessData(data);
        }
        return Helper.prototype.logProfile({tag:'after_data_fetch'}).then(success => {

            switch (typeof body.distribution.mapper) {
                case 'string':
                    if (mappers.get(body.distribution.mapper)) {
                        // Call the mapping function
                        return mappers.get(body.distribution.mapper)(data, options);
                    } else if (feed.lib[body.distribution.mapper]) {
                        // Use a mapper function defined as a library for the feed
                        return feed.lib[body.distribution.mapper](data, options);
                    } else {
                        let err = new Error('Specified mapper function not found');
                        err.status = 404;
                        throw err;
                    }
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
                    return mappers.get('defaultMapper')(data, options);
            }
        });
    });
}

/**
 * Initializes a vm and executes the script in that environment
 * @param  {object} body      [description]
 * @param  {object} vmContext [description]
 * @return {object}           Promise object: error or result of executing the script
 */
Helper.prototype.executeScript = function (body, vmContext) {
    var script = body.source;
    var vmName = body.vm || 'iothub';
    var vmOptions = {
        XMLHttpRequest: true,
        data: vmContext.data,
        lib: vmContext.feed.lib
    }

    return new Promise((resolve, reject) => {
        var context = {}
        // Get vm instance
        var vm = vmContainer.createVM(vmName, vmOptions);
        vm.runScript(script, (err, res) => {
            if (err) {
                reject(err)
            }
            Helper.prototype.logProfile({tag:'execution_end'}).then(() => {
            	resolve({res:res, context:context, data:vmContext.data});
            }, (err) => {
            	reject("Could not log profiling info for node. " + err.message);
            });
        });
    });
}

/**
 * Run the reducer function for the response pieces of data. 
 * @param  {[type]} feed    [description]
 * @param  {[type]} values  [description]
 * @param  {[type]} options [description]
 * @return {[type]}         [description]
 */
Helper.prototype.runReducer = function (feed, values, options) {
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
 * Extracts system profiling information, and saves that information in a Profiler object.
 * @param  {object} data Data object describing the attributes of the logged location in code.
 * @return {object}      Promise object: error or true.
 */
Helper.prototype.logProfile = function (data) { 
    return new Promise((resolve, reject) => {
    	if (!app.get('profiler')) {
    		resolve(true);
    	} else {

	    	if (!data.tag || typeof data.tag !== 'string') {
	    		reject(new Error('tag is a compulsory argument to logProfile data, and it must be a string'));
	    	}
	    	// ExecutableFeed.emit(data.tag);

	    	let tag = data.tag;
	    	let log = (data.level && logger[data.level]) || logger.info;
	    	let type = data.type || 'profile';
	    	let msg = (profileEvents.get(data.tag) && profileEvents.get(data.tag).msg) || data.tag;
	    	let logData = {}

	    	Object.keys(data).forEach((key) => {
	    		logData[key] = data[key];
	    	});

	    	if (type === 'profile') {
				let load = os.loadavg();
                pusage.stat(process.pid, function(err, result) {
                    // Note that sometimes result may be undefined, if async requests are made in very quick
                    // succession
                    if (result) {
                        logData.usage = {
                            cpu: result.cpu,
                            totalMem: os.totalmem(),
                            freeMem: os.freemem(),
                            processMem: process.memoryUsage().rss,
                            mem: process.memoryUsage().rss/os.totalmem()*100,
                            load: load
                        }
                        profiler.add(logData);
                        if (app.get('logProfilingInfo') === true) {
                            // log(msg, logData);
                        }
                    }
                    resolve(true);
                });

	    	} else {
	    		log('Unknown executionEvent, no operation: ', data.type);
	    		resolve(true);
	    	}
	    }
    });
};

// TODO: Might be preferable to use events for profiling info, but we need the results
// before response is sent to client for now, so support for remote logging remains as a TODO.
//  ExecutableFeed.on('executionEvent', (event) => {
//  	var log = logger[event.level] || logger.info;

//  	if (event.type === 'profile') {
		// if (app.get('enableProfiling') === true) {
  //   		usage.lookup(process.pid, usageOptions, function(err, result) {
  //   			profiler.add(event);
  //   			if (app.get('logProfilingInfo') === true) {
  //   				log(event.msg || event.tag, {tag: event.tag, time: event.time, usage: result});
  //   			}
		// 	});
//  		}
//  	} else {
//  		log('Unknown executionEvent, no operation: ', event.type);
//  	}
//  });

module.exports = Helper;
