var request = require('supertest'),
expect = require('chai').expect,
// randomstring = require('randomstring'),
app = require('../server');

var username = 'username', password = 'password';

var extend = function(inObject) {
	var ret = new Object(inObject);
	for(var i=1; i < arguments.length; i++) {
		for(var key in arguments[i]) {
			if(arguments[i][key]) {
				ret[key] = arguments[i][key];
			}
		}
	}
	return ret;
}

describe('Helper functions', function() {

	describe('extend function', function() {

		it('should return initial object if called without additional object', function(done) {
			var obj = {key: 'value'};
			var extendedObj = extend(obj);
			expect(extendedObj).to.eql(obj);
			done();
		});

		it('should overwrite properties from additional objects', function(done) {
			var obj = {key: 'value1'};
			var extendedObj = extend(obj, {key: 'value2'});
			expect(extendedObj.key).to.be.equal('value2');
			done();
		});

		it('should ignore null values', function(done) {
			var obj = {key: 'value'};
			var extendedObj = extend(obj, {key: undefined});
			expect(extendedObj).to.eql(obj);
			done();
		});

	});

});

describe("IoT Hub API, Authentication", function() {

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

describe('IoT Hub API, Authenticated', function() {

	var token;

	var validField = function(options) {
		options = options || {};
		var ret = extend({
			id: 0,
			name: '',
			type: '',
			metadata: '',
			optional: true,
			keywords: []
		}, options);
		return ret;
	};

	var validComposedFeed = function(options) {
		options = options || {};
		var fields = options._fields;
		delete options._fields;
		var ret = extend({
			name: 'testFeed',
			id: 0,
			readable: false,
			writeable: false,
			storage: false,
			keywords: [],
			metadata: '',
			_fields: [
				validField(fields)
			]
		}, options);
		return ret;
	}
	var insertValidComposedFeed = function(options, cb) {
		if (arguments.length == 1) {
			cb = options;
			options = {};
		}
		var feed = validComposedFeed(options);
		request(app)
		.post('/api/feeds/composed')
		.set('Authorization', token)
		.type('json')
		.send(JSON.stringify(feed))
		.expect(200, function(err, res) {
			expect(err).to.not.exist;
			expect(res).to.exist;
			expect(res.body).to.exist;
			expect(res.body).to.have.property('id');
			cb(res.body.id);
		});
	};

	var cleanAllComposedFeeds = function(cb) {
		app.models.ComposedFeed.destroyAll(cb);
	}

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

	describe("Composed feeds", function() {

		describe('Creating new composed feeds', function() {

			beforeEach(function(done) {
				cleanAllComposedFeeds(done);
			});

			after(function(done) {
				cleanAllComposedFeeds(done);
			});

			it("Valid composed feed", function(done) {
				insertValidComposedFeed(function(insertedId){
					done();
				});
			});

			it("Invalid composed feed (built-in validation mecanism)", function(done) {
				// the name field is missing
				var invalidFeed = validComposedFeed();
				delete invalidFeed.name;
				request(app)
				.post('/api/feeds/composed')
				.set('Authorization', token)
				.type('json')
				.send(JSON.stringify(invalidFeed))
				.expect(422, done);
			});

			it('Invalid composed feed (custom validation procedure)', function(done) {
				// no field provided
				var invalidFeed = validComposedFeed();
				invalidFeed._fields = [];
				request(app)
				.post('/api/feeds/composed')
				.set('Authorization', token)
				.type('json')
				.send(JSON.stringify(invalidFeed))
				.expect(422, done);
			});

		});

	});

	describe('General querying', function() {

		var getAllFeeds = function(cb) {
			request(app)
			.get('/api/feeds')
			.set('Authorization', token)
			.expect(200, function(err, res) {
				expect(err).to.not.exist;
				expect(res.body).to.exist;
				cb(res.body);
			});
		};

		it('Basic empty response for all feeds', function(done) {
			getAllFeeds(function(body) {
				expect(body).to.eql({count: 0, types: []});
				done();
			});
		});

		it('Getting composed feed after insertion', function(done) {
			insertValidComposedFeed(function(insertedId) {
				getAllFeeds(function(body) {
					expect(body.count).to.equal(1);
					expect(body.types).to.eql(['composed']);
					expect(body.composed).to.exist;
					expect(body.composed[0]).to.eql(validComposedFeed({id: insertedId}));
					cleanAllComposedFeeds(done);
				});
			});
		});

	});
});
