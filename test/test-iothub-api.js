var expect = require('chai').expect,
	iothub = require('../lib/iothub');


describe("IoT Hub API", function() {

	describe("Plugin", function() {

		var server, port;

		before(function() {
			// runs before all tests in this block
			var app = iothub();
			server = app.listen();
			port = server.address().port;
		});

		after(function() {
			server.close();
		});

		it("", function() {

		});

	});

});

