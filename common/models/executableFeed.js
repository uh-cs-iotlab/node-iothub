'use strict';

var FeedTypes = require('../../server/feed-types.json');
var iothubvm = require('../../lib/iothub-vm');

module.exports = function (ExecutableFeed) {

    ExecutableFeed.mixin('BaseFeed', {type: FeedTypes.EXECUTABLE});

    ExecutableFeed.runScript = function (modelId, script, params, data, cb) {
    	
    	if (!script) {
            var err = new Error("The request body is not valid. Details: 'script' can't be blank");
            err.name = 'Validation Error';
            err.statusCode = err.status = 422;
            reqP = Promise.reject(err);
        }
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
			            start = new Date().getTime();
			            vm.runScript(script, (err, res) => {
				            if (err) reject(err);
				            end = new Date().getTime();
				            resolve({
				            	time: end - start,
				            	result: res,
				            	feed: feed.name
				            });
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
                {arg: 'script', type: 'string', http: {source: 'form'}},
                {arg: 'params', type: 'object', http: {source: 'form'}},
                {arg: 'data', type: 'object', http: {source: 'form'}}
            ],
            returns: {type: 'object', root: true},
            http: {verb: 'post', path: '/:id/run'}
        }
    );

};
