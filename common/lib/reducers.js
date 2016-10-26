'use strict'

var assert = require('assert');
var logger = require('../utils/logger');

var reducers = {
    defaultReducer: function (values) {
		/**
	     * Default reducer function for combining response pieces. Maybe needs to be moved to reducers
	     * library.
	     * @param  {[type]} values [description]
	     * @return {[type]}        [description]
	     */
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
    },
	imageReducer: function (arrs) {
		var arr;
		var response;
        assert.ok(Array.isArray(arrs), "Invalid argument for reducer given. Array expected, " + typeof arrs + " found.");
        let type = arrs[0].result.data.type || 'Array';

        if (Array.isArray(arrs)) { 
        	var width = arrs[0].result.width
        	var bufs = [];
        	var height;
			var profilerData = [];
        	
        	if (type === 'Array') {
        		height = arrs[0].result.height;
        	} else {
        		height = arrs[0].result.height * arrs.length;
        	}

	        for (let item of arrs) {
	   			if (type === 'Array') {
	   				bufs.push(item.result.data);
	   			} else {
	   				bufs.push(item.result.data.data);
		   		}
	   			if (item.profiler && item.profiler.enabled) {
					let profilerPieceData = {
						pieceId: item.pieceId,
						data: item.profiler.data
					}
					// Add each piece's profiling information
					if (item.profiler.piecesData) {
						profilerPieceData['piecesData'] = item.profiler.piecesData;
					}
					profilerData.push(profilerPieceData);
	   			}
	        }
	        // Nice way to concatenate n arrays
	        arr = [].concat.apply([], bufs);

	        if (profilerData.length > 0) {
	        	[].concat.apply([], profilerData);
	        }
	    } else {
	    	throw new TypeError('Invalid parameter type, Array needed. ' + typeof arrs);
	    }
	    response = {
        	result: {
        		width: width,
        		height: height,
        		data: arr
        	}
        }
        if (profilerData.length > 0) {
        	response.profilerData = profilerData;
        }
        return response;
	}
}

var get = function (name) {
	return reducers[name] || false;
}

module.exports = {
	get: get

}
