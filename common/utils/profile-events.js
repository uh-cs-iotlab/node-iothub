'use strict'

var events = {
	"after_data_fetch": {
		"msg":"After fetching data"
	},
	"after_data_map": {
		"msg":"Getting data + mapping"
	},
	"feed_fetched": {
		"msg":"After fetching feed info"
	},
	"piece_response_latency": {
		"msg":"After piece response arrived"
	},
	"execution_end": {
		"msg":"After execution ended"
	},
	"dist_response_latency": {
		"msg":"All responses arrived"
	},
	"reducer_latency": {
		"msg":"Reducer runtime"
	},
	"total_latency": {
		"msg":"Total time"
	},
	"before_sending_response": {
		"msg":"Total after data fetch + execution"
	}
}

var get = function (tag) {
	if (typeof tag === 'string' && events[tag]) {
		return events[tag];
	}
	return false;
}

module.exports = {
	get: get
}
