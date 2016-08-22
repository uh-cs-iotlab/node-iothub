'use strict'

var mappers = {
	defaultMapper: function (elem, options) {
		/**
	     * Takes a data element and node count as arguments, and divides the given array to an array of subarrays
	     * @param  {[type]} elem    [description]
	     * @param  {[type]} options [description]
	     * @return {[type]}         [description]
	     */
    
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
    },
    imageUrlMapper: function (imgObject, options) {
    	options = options || {}
	    var arr = imgObject.data.data;

	    var ret = []
	      , len = arr.length
	      , obj = null
	      , tmpArr = []
	      , nodeCount = options.nodeCount || options.nodes.length

	    var pieceLength = Math.floor(len/nodeCount);

	    var i, j, chunk = pieceLength;
	    for (let i = 1, j = 1; i <= len; i++) {
	        // Check if subarray is equal to the length of the wanted piece, and that this is not 
	        // the last piece of input array. NOTE! Last piece will also include any remaining data in the array. 
	        // Thus, it would be best to have data such that: dataLength mod nodeCount would be close to 0. 
	        // Otherwise the last piece could have more data than other pieces, and takes longer to process 
	        // than other nodes.
	        let tmpObj = {
                name: imgObject.name,
                type: 'url-piece',
                pieceId: j,
                data: {
                	height: imgObject.data.height,
                	width: imgObject.data.width,
                	data: tmpArr
                },
                contentType: imgObject.contentType,
                processors: imgObject.processors
            }

            tmpArr.push(arr[i-1]);
	        if (i % pieceLength === 0 && j !== nodeCount) {
            	ret.push(tmpObj);
	            tmpArr = [];
	            j++;
	        } else if (i === len) {
	        	ret.push(tmpObj);
	        }
	    }
	    return ret;
    },
    imageDataMapper: function (imgObject, options) {
    	options = options || {}
	    var arr = imgObject.data.data;

	    var ret = []
	      , len = arr.length
	      , obj = null
	      , tmpArr = []
	      , nodeCount = options.nodeCount || options.nodes.length

	    var pieceLength = Math.floor(len/nodeCount);

	    var i, j, chunk = pieceLength;
	    for (let i = 1, j = 1; i <= len; i++) {
	        // Check if subarray is equal to the length of the wanted piece, and that this is not 
	        // the last piece of input array. NOTE! Last piece will also include any remaining data in the array. 
	        // Thus, it would be best to have data such that: dataLength mod nodeCount would be close to 0. 
	        // Otherwise the last piece could have more data than other pieces, and takes longer to process 
	        // than other nodes.
	        let tmpObj = {
                name: imgObject.name,
                type: 'piece',
                pieceId: j,
                data: {
                	height: imgObject.data.height,
                	width: imgObject.data.width,
                	data: tmpArr
                },
                contentType: imgObject.contentType,
                processors: imgObject.processors
            }

            tmpArr.push(arr[i-1]);
	        if (i % pieceLength === 0 && j !== nodeCount) {
            	ret.push(tmpObj);
	            tmpArr = [];
	            j++;
	        } else if (i === len) {
	        	ret.push(tmpObj);
	        }
	    }
	    return ret;
    },
	oldImageDataMapper: function (imgObject, options) {

	    options = options || {}
	    var arr = imgObject.data.data;
	    
	    // Here should check validity of image object!

	    // if (!Array.isArray(arr)) {
	    //     var err = new Error('Data error: argument must be a valid Array');
	    //     err.status = 400;
	    //     throw err;
	    // }

	    var ret = []
	      , len = arr.length
	      , obj = null
	      , tmpArr = []
	      , nodeCount = options.nodeCount || options.nodes.length

	    var pieceLength = Math.floor(len/nodeCount);

	    var i, j, chunk = pieceLength;

	    // This is an attempt to make image mapper simpler, not currently working. 
	    // Results in green picture somehow..
		// for (i=0,j=len; i<j; i+=chunk) {
		//     tmpArr = arr.slice(i,i+chunk);
		//     console.log(tmpArr[0])
		//     obj = {
  //               name: imgObject.name,
  //               type: 'piece',
  //               pieceId: i,
  //               data: {
  //               	height: imgObject.data.height,
  //               	width: imgObject.data.width,
  //               	data:tmpArr
  //               },
  //               contentType: imgObject.contentType,
  //               processors: imgObject.processors
  //           }
  //           ret.push(obj);
		    
		// }
	    
	    for (let i = 1, j = 1; i <= len; i++) {
	        // Check if subarray is equal to the length of the wanted piece, and that this is not 
	        // the last piece of input array. Last piece will also include any remaining data in array. 
	        // Thus, it would be best to have data such that: dataLength mod nodeCount would be close to 0. 
	        // Otherwise the last piece could have more data than other pieces, and takes longer to process 
	        // than other nodes.
	        if (i % pieceLength === 0 && j !== nodeCount) {
	            tmpArr.push(arr[i-1]);
	            obj = {
	                name: imgObject.name,
	                type: 'piece',
	                pieceId: j,
	                data: {
	                	height: imgObject.data.height,
	                	width: imgObject.data.width,
	                	data:tmpArr
	                },
	                contentType: imgObject.contentType,
	                processors: imgObject.processors
	            }
	            ret.push(obj);
	            tmpArr = [];
	            j++;
	        } else {
	            tmpArr.push(arr[i-1]);
	            // if this is the last index of array, push 
	            if (i === len) {
	                // Note! Add width and height to piece data, to enable later reducers encoding back to jpeg
	                obj = {
	                    name: imgObject.name,
	                    type: 'piece',
	                    pieceId: j,
	                    data: {
		                	height: imgObject.data.height,
		                	width: imgObject.data.width,
		                	data: tmpArr
		                },
	                    contentType: imgObject.contentType,
	                    processors: imgObject.processors
	                }
	                ret.push(obj);
	            }
	        }
	    }
	    return ret;
	}
}

var get = function (name) {
	return mappers[name] || false;
}

module.exports = {
	get: get
}
