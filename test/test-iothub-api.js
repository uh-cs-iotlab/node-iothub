var expect = require('chai').expect,
	request = require('request'),
	randomstring = require('randomstring'),
	iothub = require('../lib/iothub');


describe("IoT Hub API", function() {

	describe("Authentication", function() {

		var server, port;

		before(function() {
			//The config should set the port to a random number
			//Create a Role for administrator where only one user belong to
			//All the db should be set to memory to 
			var config = {
				name: randomstring.generate()
			};

			var app = iothub(config);
			server = app.listen();
			port = server.address().port;
		});

		after(function() {
			server.close();
		});

		it("Non autenticated request should be rejected by default", function(done) {
			var options = {
                method: 'GET',
                uri: 'http://localhost:' + port
            };
            request.get(options, function(error, response, body) {
                expect(error).to.exist;
                done();
            });
		});

		it("Autenticated request by admin", function(done) {
			var options = {
                method: 'GET',
                uri: 'http://localhost:' + port
            };
            request.get(options, function(error, response, body) {
                expect(error).to.exist;
                done();
            });
		})


	});

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

