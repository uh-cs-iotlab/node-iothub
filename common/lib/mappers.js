'use strict'

const url = require('url');

let mappers = {
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
    imageUrlMapper: function (dataElement, distributeOptions) {
    	let options = distributeOptions || {};

		let ret = []
	      , len = dataElement.maxNodes || options.nodes.length;

	    let urlParts = url.parse(dataElement.url, true);
        urlParts.search = null; // Remove search part of the url so that format() uses the values we want

	    for (let i = 1; i <= len; i++) {

            // TODO: don't hardcode these keys/values
            urlParts.query.size = parseInt(urlParts.query.size);
			let pieceId = dataElement.pieceId ? dataElement.pieceId + '.' + i : i + '';
			let maxNodesLevel = dataElement.maxNodesLevel ? dataElement.maxNodesLevel + '.' + len : len + '';

			// Calculate how big piece of the whole image this piece is, by multiplying max nodes per level
			let maxNodesCount = maxNodesLevel.split('.').reduce(function (a, b) {return a * b}, 1);
			urlParts.query.nodes = maxNodesCount;
			urlParts.query.index = i;
			let tmpObj = {
                name: dataElement.name,
                type: 'piece',
				pieceId: pieceId,
                url: urlParts.format(),
               	contentType: dataElement.contentType,
                processors: dataElement.processors,
				maxNodesLevel: maxNodesLevel
            }
            ret.push(tmpObj);
	    }
	    return ret;
    },
    imageDataMapper: function (imgObject, distributeOptions) {
    	let options = distributeOptions || {}
	    let arr = imgObject.data.data;

	    let ret = []
	      , len = arr.length
	      , pieceData = []
	      , nodeCount = options.nodeCount || options.nodes.length

	    let pieceLength = Math.floor(len/nodeCount);
		let pieceHeight = parseInt(imgObject.data.height)/nodeCount;

		console.time('map')
	    for (let i = 1, j = 1; i <= len; i++) {
            pieceData.push(arr[i-1]);
            let pieceId = imgObject.pieceId ? imgObject.pieceId + '.' + j : j + '';
			let maxNodesLevel = imgObject.maxNodesLevel ? imgObject.maxNodesLevel + '.' + len : len + '';
	        let pieceObj = {
                name: imgObject.name,
                type: 'piece',
                pieceId: pieceId,
                data: {
                	height: pieceHeight,
                	width: imgObject.data.width,
                	data: pieceData
                },
                contentType: imgObject.contentType,
                processors: imgObject.processors,
				maxNodesLevel: maxNodesLevel
            };
	        // Check if subarray is equal to the length of the wanted piece, and that this is not 
	        // the last piece of input array. NOTE! Last piece will also include any remaining data in the array. 
	        // Thus, it would be best to have data such that: dataLength mod nodeCount would be close to 0. 
	        // Otherwise the last piece could have more data than other pieces, and takes longer to process 
	        // than other nodes.
	        if (i % pieceLength === 0 && j !== nodeCount) {
            	ret.push(pieceObj);
	            pieceData = [];
	            j++;
	        } else if (i === len) {
	        	ret.push(pieceObj);
	        }
	    }
	    console.timeEnd('map')

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

let get = function (name) {
	return mappers[name] || false;
}

module.exports = {
	get: get
}
