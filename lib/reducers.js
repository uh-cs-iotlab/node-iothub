'use strict'

var assert = require('assert');

var reducers = {
	imageReducer: function (arrs) {
		var arr;
        assert.ok(Array.isArray(arrs), "Invalid argument for reducer given. Array expected, " + typeof arrs + " found.");

        if (Array.isArray(arrs)) { 
        	var width = arrs[0].result.width
        	  , height = arrs[0].result.height
        	var bufs = [];

	        for (let item of arrs) {
	   			bufs.push(item.result.data);
	        }
	        // Nice way to concatenate n arrays
	        arr = [].concat.apply([], bufs);
	    } else {
	    	throw new TypeError('Invalid parameter type, Array needed. ' + typeof arrs);
	    }
        return {
        	result: {
        		width: width,
        		height: height,
        		data: arr
        	}
        }
	}
}

var get = function (name) {
	return reducers[name] || false;
}

module.exports = {
	get: get

}
