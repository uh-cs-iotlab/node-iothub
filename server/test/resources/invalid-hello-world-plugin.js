var HelloWorldPlugin = { 
	
	needConfiguration: false,
	checkConfiguration: function(data) { return true; },
	configure: function(config) {},
	isFeatureSupported: function(name) { return true; },
	//isFeatureAvailable: function(name) { return true; },
	isFeatureReadable: function(name) { return true; },
	isFeatureWritable: function(name) { return false; },
	getNumberOfFeatures: function() { return 1; },
	postFeatureValue: function(name, data) { return false; },
	getFeatureDescription: function(index) {
		if (index == 0) { 
			return JSON.stringify({name: "message", type: "string"});
		} else {return null;}
	},
	getFeatureValue: function (name) {
		if (name !== "message") { return null; }
		return JSON.stringify('Hello World');
	}
};