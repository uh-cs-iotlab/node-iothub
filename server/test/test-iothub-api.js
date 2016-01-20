var request = require('supertest'),
async = require('async'),
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
};

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

		var makeRequest = function(token, callback) {
			request(app)
			.get('/api/feeds')
			.set('Authorization', token)
			.expect(200)
			.end(function() {
				callback();
			});
		};

		var User = app.models.User;
		User.login(
			{username: username, password: password},
			function(err, token) {
				expect(err).to.not.exist;
				expect(token).to.exist;
				makeRequest(token.id, function() {
					User.logout(token.id, function (err) {
						expect(err).to.not.exist;
						done();
					});
				});
			}
		);
	});
});

describe('IoT Hub API, Authenticated', function() {

	var token;

	var validField = function(options) {
		options = options || {};
		var ret = extend({
			name: '',
			type: '',
			metadata: '',
			optional: true,
			keywords: []
		}, options);
		return ret;
	};
	var insertValidField = function(idOptions, options, cb) {
		if (typeof options === 'function' && cb === undefined) {
			// insertValidField(idOptions, cb)
			cb = options;
			options = {};
		}
		var field = validField(options);
		request(app)
		.post('/api/feeds/' + idOptions.feedType + '/' + idOptions.id + '/' + idOptions.fieldProperty)
		.set('Authorization', token)
		.type('json')
		.send(JSON.stringify(field))
		.expect(200, function(err, res) {
			expect(err).to.not.exist;
			expect(res).to.exist;
			expect(res.body).to.exist;
			expect(res.body).to.have.property('id');
			cb(res.body.id);
		});
	};

	var validAtomicFeed = function(options) {
		options = options || {};
		var ret = extend({
			name: 'testFeed',
			keywords: [],
			metadata: '',
			_field: {}
		}, options);
		return ret;
	};
	var insertValidAtomicFeed = function(options, cb) {
		if (typeof options === 'function' && cb === undefined) {
			// insertValidAtomicFeed(cb)
			cb = options;
			options = {};
		}
		var feed = validAtomicFeed(options);
		request(app)
		.post('/api/feeds/atomic')
		.set('Authorization', token)
		.type('json')
		.send(JSON.stringify(feed))
		.expect(200, function(err, res) {
			expect(err).to.not.exist;
			expect(res).to.exist;
			expect(res.body).to.exist;
			expect(res.body).to.have.property('id');
			insertValidField({
				feedType: 'atomic',
				id: res.body.id,
				fieldProperty: 'field'
			}, function(fieldId) {
				cb(res.body.id, fieldId);
			})
		});
	};
	var cleanAllAtomicFeeds = function(cb) {
		app.models.AtomicFeed.find(function(err, feeds) {
			expect(err).to.not.exist;
			async.each(feeds, function(feed, callback) {
				feed.field.destroy(function(err) {
					feed.field(function(err, field) {
						expect(field).to.not.exist;
						callback();
					});
				});
			}, function(feedErr) {
				expect(feedErr).to.not.exist;
				app.models.AtomicFeed.destroyAll(cb);
			});
		});
	};

	var validComposedFeed = function(options) {
		options = options || {};
		var ret = extend({
			name: 'testFeed',
			readable: false,
			writeable: false,
			storage: false,
			keywords: [],
			metadata: '',
			_fields: []
		}, options);
		return ret;
	};
	var insertValidComposedFeed = function(options, cb) {
		if (typeof options === 'function' && cb === undefined) {
			// insertValidComposedFeed(cb)
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
			insertValidField({
				feedType: 'composed',
				id: res.body.id,
				fieldProperty: 'fields'
			}, function(fieldId) {
				cb(res.body.id, fieldId);
			})
		});
	};
	var cleanAllComposedFeeds = function(cb) {
		app.models.ComposedFeed.find(function(err, feeds) {
			expect(err).to.not.exist;
			async.each(feeds, function(feed, callback) {
				feed.fields.destroyAll(function(err) {
					feed.fields.count(function(err, count) {
						expect(count).to.equal(0);
						callback();
					});
				});
			}, function(feedErr) {
				expect(feedErr).to.not.exist;
				app.models.ComposedFeed.destroyAll(cb);
			});
		});
	};

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

	describe('Atomic feeds', function() {

		describe('Creating new atomic feeds', function() {

			beforeEach(function(done) {
				cleanAllAtomicFeeds(done);
			});

			after(function(done) {
				cleanAllAtomicFeeds(done);
			});

			it('Valid atomic feed', function(done) {
				insertValidAtomicFeed(function(insertedId, fieldId) {
					done();
				});
			});

			it("Invalid atomic feed (built-in validation mecanism)", function(done) {
				// the name field is missing
				var invalidFeed = validAtomicFeed();
				delete invalidFeed.name;
				request(app)
				.post('/api/feeds/atomic')
				.set('Authorization', token)
				.type('json')
				.send(JSON.stringify(invalidFeed))
				.expect(422, done);
			});

			it('Should find a previously inserted feed', function(done) {
				insertValidAtomicFeed(function(insertedId, fieldId) {
					request(app)
					.get('/api/feeds/atomic/' + insertedId)
					.set('Authorization', token)
					.expect(200, function(err, res) {
						expect(err).to.not.exist;
						expect(res).to.exist;
						expect(res.body).to.eql(validAtomicFeed({
							id: insertedId,
							_field: validField({ id: fieldId })
						}));
						done();
					});
				});
			});

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
				insertValidComposedFeed(function(insertedId, fieldId){
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

			it('Should find a previously inserted feed', function(done) {
				insertValidComposedFeed(function(insertedId, fieldId) {
					request(app)
					.get('/api/feeds/composed/' + insertedId)
					.set('Authorization', token)
					.expect(200, function(err, res) {
						expect(err).to.not.exist;
						expect(res).to.exist;
						expect(res.body).to.eql(validComposedFeed({
							id: insertedId,
							_fields: [
								validField({ id: fieldId })
							]
						}));
						done();
					});
				});
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

		it('Getting all types of feeds after insertion', function(done) {
			insertValidAtomicFeed(function(atomicId, atomicFieldId) {
				insertValidComposedFeed(function(composedId, composedFieldId) {
					getAllFeeds(function(body) {
						expect(body.count).to.equal(2);
						expect(body.types).to.have.members(['atomic', 'composed']);
						// AtomicFeed
						expect(body.atomic).to.exist;
						expect(body.atomic[0]).to.eql(validAtomicFeed({
							id: atomicId,
							_field: validField({id: atomicFieldId})
						}));
						// ComposedFeed
						expect(body.composed).to.exist;
						expect(body.composed[0]).to.eql(validComposedFeed({
							id: composedId,
							_fields: [
								validField({id: composedFieldId})
							]
						}));
						cleanAllAtomicFeeds(function() {
							cleanAllComposedFeeds(done);
						});
					});
				});
			});
		});

	});
});
