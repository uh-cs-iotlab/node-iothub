var expect = require('chai').expect,
	request = require('request'),
	randomstring = require('randomstring'),
	iothub = require('../lib/iothub');

var app, server, port, username = 'username', password = 'password';

function startServer(done) {
	//The config should set the port to a random number
	//Create a Role for administrator where only one user belong to
	//All the db should be set to memory to 
	var config = {
		name: randomstring.generate(),
		port: 0, // Random port number
		datasources: {
			//For the testing we only use the memory
			"memory": {connector: "memory"},
			//Set the memory db as default
			"default": "memory"
		}
	};

	app = iothub(config);

	//Need to create one User who is an admin
	var User = app.models.User;
	var Role = app.models.Role;
	var RoleMapping = app.models.RoleMapping;

	var startTheServer = function() {
		server = app.listen();
		port = server.address().port;
		done();
	}

	User.create(
		{username: username, email: username + '@hub.fi', password: password }, 
		function(err, user) {
			expect(err).to.not.exist;
			expect(user).to.exist;
					
			//I need to get the admin role
			Role.findOne(
				{ where: {name: 'admin'} },
				function(err, role) {
					expect(err).to.not.exist;
					expect(role).to.exist;

					//Assign our user to the role
					role.principals.create(
						{
        					principalType: RoleMapping.USER,
        					principalId: user.id
      					}, 
      					function(err, principal) {
        					expect(err).to.not.exist;
							expect(role).to.exist;
							startTheServer();
      					}
      				);
				}
			);			
		}
	);
}

describe("IoT Hub API", function() {

	describe("Authentication", function() {

		before(function(done) {
			startServer(done);
		});

		after(function() {
			server.close();
		});

		it("Non autenticated request should be rejected by default", function(done) {

			var options = {
                method: 'GET',
                uri: 'http://localhost:' + port + "/api/feeds/count"
            };
            request.get(options, function(error, response, body) {
            	expect(response.statusCode).to.not.equal(200);
                done();
            });
		});

		it("Authenticated request by admin", function(done) {
			
			var User = app.models.User;
			var makeRequest = function(token, callback) {
				var options = {
                	method: 'GET',
                	uri: 'http://localhost:' + port + "/api/feeds/count",
                	headers: {
        				'Authorization': token
    				}
            	};
            	request.get(options, function(error, response, body) {
            		expect(response.statusCode).to.equal(200);
                	callback(token);
            	});
			}

			var logout = function(token) {
				User.logout(token, function (err) {
     				expect(err).to.not.exist;
     				done();
   				});
			}

			User.login({username: username, password: password},
				function(err, token) {
					expect(err).to.not.exist;
					expect(token).to.exist;
					makeRequest(token.id, logout);
				}
			);   
		});
	});

	describe("Executable feeds", function() {

		var token;

		before(function(done) {
			startServer(function() {
				var User = app.models.User;
				User.login({username: username, password: password},
				function(err, res) {
					expect(err).to.not.exist;
					expect(res).to.exist;
					token = res.id;
					done();
				}
			);   
			});
		});

		after(function(done) {
			var User = app.models.User;
			User.logout(token, function (err) {
     			expect(err).to.not.exist;
     			server.close();
     			done();
   			});
		});

		it("Create a new feed", function(done) {
			var options = {
            	method: 'POST',
                uri: 'http://localhost:' + port + "/api/feeds/",
                headers: {
        			'Authorization': token
    			},
    			json: {
    				'named': 'test'
    			}
            };
            request.post(options, function(error, response, body) {
            	console.log(body);
            	expect(response.statusCode).to.equal(200);
                done();
            });
		});
	});

});

