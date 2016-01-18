var request = require('supertest'),
expect = require('chai').expect,
// randomstring = require('randomstring'),
app = require('../server');

var username = 'username', password = 'password';

describe("IoT Hub API", function() {

	describe("Authentication", function() {

		it("Non autenticated request should be rejected by default", function(done) {
			request(app)
			.get('/api/feeds')
			.expect(401, done);
		});

		it("Authenticated request by admin", function(done) {

			var User = app.models.User;
			var makeRequest = function(token, callback) {
				request(app)
				.get('/api/feeds/test')
				.set('Authorization', token)
				.expect(200)
				.end(function() {
					callback(token);
				});
			};

			var logout = function(token) {
				User.logout(token, function (err) {
					expect(err).to.not.exist;
					done();
				});
			}

			User.login(
				{username: username, password: password},
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
			var User = app.models.User;
			User.login(
				{username: username, password: password},
				function(err, res) {
					expect(err).to.not.exist;
					expect(res).to.exist;
					token = res.id;
					done();
				}
			);
		});

		after(function(done) {
			var User = app.models.User;
			User.logout(token, function (err) {
				expect(err).to.not.exist;
				done();
			});
		});

		it("Create a new composed feed", function(done) {
			request(app)
			.post('/api/feeds/composed')
			.set('Authorization', token)
			.type('json')
			.send(JSON.stringify(
				{
					"field": [
						{ "key": "value" }
					],
					"id": 0,
					"keyword": [
						"aKeyword"
					]
				}
			))
			.expect(200, done);
		});
	});
});
