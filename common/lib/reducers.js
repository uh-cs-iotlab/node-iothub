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
		assert.ok(Array.isArray(arrs), "Invalid argument for reducer given. Array expected, " + typeof arrs + " found.");
		let arr, height, width;
		let response;
		let type = arrs[0].result.data && arrs[0].result.data.type || 'Array';

		if (Array.isArray(arrs)) {
        	let bufs = [];
			let profilerData = [];
			let arrHeights = [];
			width = arrs[0].result.width

	        for (let item of arrs) {
				let thisBufferType  = item.result.data && item.result.data.type || 'Array';
				arrHeights.push(item.result.height);
				if (thisBufferType === 'Array') {
					// console.log('array')
					bufs.push(item.result.data);
	   			} else {
					// console.log('buffer')
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

            // Calculate the height of the image from the pieces' heights
			height = arrHeights.reduce((a, b) => {return parseInt(a)+parseInt(b)}, 0);
			// Nice way to concatenate n arrays
			arr = [].concat.apply([], bufs);

			if (profilerData.length > 0) {
	        	[].concat.apply([], profilerData);
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
		} else {
			throw new TypeError('Invalid parameter type, Array needed. ' + typeof arrs);
		}
	}
}

var get = function (name) {
	return reducers[name] || false;
}

module.exports = {
	get: get

}
