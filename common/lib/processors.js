'use strict'

var jpeg = require('jpeg-js');

/*
	Processing functions for mofidying data. Data can be processed on two
	occasions: after fetched from source and before it is passed to a script 
	or after script execution before sending the results back.
 */
var processors = {
	jpegEncode: function (img) {
		return jpeg.encode(img).data;
	},
	jpegDecode: function (jpg) {
		return jpeg.decode(jpg);
	},
	filterParams: function (data, filters) {
		var ret = {}
		filters.forEach(function(key) {
			if (data.hasOwnProperty(key)) {
				ret[key] = data[key];
			}
		});
		return ret;
	} 
}

var get = function (name) {
	return processors[name] || false;
}

module.exports = {
	get: get
}
