var app = require('../server');
var Helper = require('./test-helper')(app);

var request = require('supertest');
var expect = require('chai').expect;

var username = 'username', password = 'password';

describe('Helper functions', function() {

	describe('extend function', function() {

		it('should return initial object if called without additional object', function(done) {
			var obj = {key: 'value'};
			var extendedObj = Helper.extend(obj);
			expect(extendedObj).to.eql(obj);
			done();
		});

		it('should overwrite properties from additional objects', function(done) {
			var obj = {key: 'value1'};
			var extendedObj = Helper.extend(obj, {key: 'value2'});
			expect(extendedObj.key).to.be.equal('value2');
			done();
		});

		it('should ignore null values', function(done) {
			var obj = {key: 'value'};
			var extendedObj = Helper.extend(obj, {key: undefined});
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

	describe('Fields', function () {

		beforeEach(function (done) {
			Helper.cleanAllAtomicFeeds(token, done);
		});

		after(function (done) {
			Helper.cleanAllAtomicFeeds(token, done);
		});

		it('Should find a previously inserted field', function(done) {
			Helper.insertValidAtomicFeed(token, function(insertedId, fieldId) {
				app.models.Field.find(function (err, fields) {
					expect(err).to.not.exist;
					expect(fields).to.have.length(1);
					expect(fields[0].getId()).to.equal(fieldId);
					done();
				});
			});
		});

	});

	describe('Atomic feeds', function() {

		beforeEach(function(done) {
			Helper.cleanAllAtomicFeeds(token, done);
		});

		after(function(done) {
			Helper.cleanAllAtomicFeeds(token, done);
		});

		it('Valid atomic feed', function(done) {
			Helper.insertValidAtomicFeed(token, function(insertedId, fieldId) {
				done();
			});
		});

		it("Invalid atomic feed (built-in validation mecanism)", function(done) {
			// the name field is missing
			var invalidFeed = Helper.validAtomicFeed();
			delete invalidFeed.name;
			request(app)
			.post('/api/feeds/atomic')
			.set('Authorization', token)
			.type('json')
			.send(JSON.stringify(invalidFeed))
			.expect(422, done);
		});

		it('Should find a previously inserted feed', function(done) {
			Helper.insertValidAtomicFeed(token, function(insertedId, fieldId) {
				request(app)
				.get('/api/feeds/atomic/' + insertedId)
				.set('Authorization', token)
				.expect(200, function(err, res) {
					expect(err).to.not.exist;
					expect(res).to.exist;
					expect(res.body).to.eql(Helper.validAtomicFeed({
						id: insertedId,
						_field: Helper.validField({ id: fieldId })
					}));
					done();
				});
			});
		});

		it('Should delete a previously inserted feed', function (done) {
			Helper.insertValidAtomicFeed(token, function (insertedId) {
				Helper.deleteFields(token, {
					feedType: 'atomic',
					id: insertedId,
					fieldProperty: 'field'
				}, function () {
					request(app)
					.delete('/api/feeds/atomic/' + insertedId)
					.set('Authorization', token)
					.expect(200, function (err, res) {
						expect(err).to.not.exist;
						expect(res).to.exist;
						Helper.getFeedsOfType(token, 'atomic', function (feeds) {
							expect(feeds).to.have.length(0);
							done();
						});
					});
				});
			});
		});

	});

	describe("Composed feeds", function() {

		beforeEach(function(done) {
			Helper.cleanAllComposedFeeds(token, done);
		});

		after(function(done) {
			Helper.cleanAllComposedFeeds(token, done);
		});

		it("Valid composed feed", function(done) {
			Helper.insertValidComposedFeed(token, function(insertedId, fieldId){
				done();
			});
		});

		it("Invalid composed feed (built-in validation mecanism)", function(done) {
			// the name field is missing
			var invalidFeed = Helper.validComposedFeed();
			delete invalidFeed.name;
			request(app)
			.post('/api/feeds/composed')
			.set('Authorization', token)
			.type('json')
			.send(JSON.stringify(invalidFeed))
			.expect(422, done);
		});

		it('Should find a previously inserted feed', function(done) {
			Helper.insertValidComposedFeed(token, function(insertedId, fieldId) {
				request(app)
				.get('/api/feeds/composed/' + insertedId)
				.set('Authorization', token)
				.expect(200, function(err, res) {
					expect(err).to.not.exist;
					expect(res).to.exist;
					expect(res.body).to.eql(Helper.validComposedFeed({
						id: insertedId,
						_fields: [
							Helper.validField({ id: fieldId })
						]
					}));
					done();
				});
			});
		});

		it('Should delete a previously inserted feed', function (done) {
			Helper.insertValidComposedFeed(token, function (insertedId) {
				request(app)
				.delete('/api/feeds/composed/' + insertedId)
				.set('Authorization', token)
				.expect(200, function (err, res) {
					expect(err).to.not.exist;
					expect(res).to.exist;
					Helper.getFeedsOfType(token, 'composed', function (feeds) {
						expect(feeds).to.have.length(0);
						done();
					});
				});
			});
		});

	});

	describe('Executable feeds', function() {

		beforeEach(function(done) {
			Helper.cleanAllExecutableFeeds(token, done);
		});

		after(function(done) {
			Helper.cleanAllExecutableFeeds(token, done);
		});

		it("Valid executable feed", function(done) {
			Helper.insertValidExecutableFeed(token, function(insertedId){
				done();
			});
		});

		it("Invalid executable feed (built-in validation mecanism)", function(done) {
			// the name field is missing
			var invalidFeed = Helper.validExecutableFeed();
			delete invalidFeed.name;
			request(app)
			.post('/api/feeds/executable')
			.set('Authorization', token)
			.type('json')
			.send(JSON.stringify(invalidFeed))
			.expect(422, done);
		});

		it('Should find a previously inserted feed', function(done) {
			Helper.insertValidExecutableFeed(token, function(insertedId) {
				request(app)
				.get('/api/feeds/executable/' + insertedId)
				.set('Authorization', token)
				.expect(200, function(err, res) {
					expect(err).to.not.exist;
					expect(res).to.exist;
					expect(res.body).to.eql(Helper.validExecutableFeed({
						id: insertedId
					}));
					done();
				});
			});
		});

		it('Should delete a previously inserted feed', function (done) {
			Helper.insertValidExecutableFeed(token, function (insertedId) {
				request(app)
				.delete('/api/feeds/executable/' + insertedId)
				.set('Authorization', token)
				.expect(200, function (err, res) {
					expect(err).to.not.exist;
					expect(res).to.exist;
					Helper.getFeedsOfType(token, 'executable', function (feeds) {
						expect(feeds).to.have.length(0);
						done();
					});
				});
			});
		});

	});

	describe('General querying', function() {

		var getAllFeeds = function(token, cb) {
			request(app)
			.get('/api/feeds')
			.set('Authorization', token)
			.expect(200, function(err, res) {
				expect(err).to.not.exist;
				expect(res.body).to.exist;
				cb(res.body);
			});
		};

		var cleanAllFeeds = function(token, cb) {
			Helper.cleanAllAtomicFeeds(token, function() {
				Helper.cleanAllComposedFeeds(token, function () {
					Helper.cleanAllExecutableFeeds(token, cb);
				});
			});
		};

		beforeEach(function (done) {
			cleanAllFeeds(token, done);
		});

		after(function(done) {
			cleanAllFeeds(token, done);
		});

		it('Basic empty response for all feeds', function(done) {
			getAllFeeds(token, function(body) {
				expect(body).to.eql({count: 0, types: []});
				done();
			});
		});

		it('Getting all types of feeds after insertion', function(done) {
			Helper.insertValidAtomicFeed(token, function(atomicId, atomicFieldId) {
				Helper.insertValidComposedFeed(token, function(composedId, composedFieldId) {
					Helper.insertValidExecutableFeed(token, function (executableId) {
						getAllFeeds(token, function(body) {
							expect(body.count).to.equal(3);
							expect(body.types).to.have.members(['atomic', 'composed', 'executable']);
							// AtomicFeed
							expect(body.atomic).to.exist;
							expect(body.atomic[0]).to.eql(Helper.validAtomicFeed({
								id: atomicId,
								_field: Helper.validField({id: atomicFieldId})
							}));
							// ComposedFeed
							expect(body.composed).to.exist;
							expect(body.composed[0]).to.eql(Helper.validComposedFeed({
								id: composedId,
								_fields: [
									Helper.validField({id: composedFieldId})
								]
							}));
							// ExecutableFeed
							expect(body.executable).to.exist;
							expect(body.executable[0]).to.eql(Helper.validExecutableFeed({
								id: executableId
							}));
							done();
						});
					});
				});
			});
		});

	});
});

describe('Controlling access to feeds for clients', function() {

	var clientUsername = 'client',
		clientPassword = 'password';
	var adminToken;
	var clientRoleId;
	var clientToken;

	before(function(done) {
		var User = app.models.User;
		var Role = app.models.Role;
		var RoleMapping = app.models.RoleMapping;
		User.login(
			{username: username, password: password},
			function(err, res) {
				expect(err).to.not.exist;
				expect(res).to.exist;
				adminToken = res.id;
				// Create client role
				Role.create(
					{name: 'client'},
					function (err, role) {
						expect(err).to.not.exist;
						expect(role).to.exist;
						clientRoleId = role.id;
						// Create a user and associate it to the client role
						User.create(
							{username: clientUsername, email: clientUsername+'@hub.fi', password: clientPassword},
							function (err, user) {
								expect(err).to.not.exist;
								expect(user).to.exist;
								role.principals.create({
									principalType: RoleMapping.USER,
		                            principalId: user.id
		                        }, function(err, principal) {
		                            expect(err).to.not.exist;
									expect(principal).to.exist;
		                            // Log client in
									User.login(
										{username: clientUsername, password: clientPassword},
										function (err, token) {
											expect(err).to.not.exist;
											expect(token).to.exist;
											clientToken = token.id;
											done();
										}
									);
		                        });
							}
						);
					}
				);
			}
		);
	});

	beforeEach(function (done) {
		Helper.cleanAllAtomicFeeds(adminToken, done);
	});

	after(function(done) {
		Helper.cleanAllAtomicFeeds(adminToken, function () {
			var User = app.models.User;
			User.logout(clientToken, function (err) {
				expect(err).to.not.exist;
				User.logout(adminToken, function (err) {
					expect(err).to.not.exist;
					done();
				});
			});
		});
	});

	var insertFeedRoleAcl = function (token, options, cb) {
		request(app)
		.post('/api/feeds/'+options.feedType+'/'+options.feedId+'/role-acl')
		.set('Authorization', token)
		.type('json')
		.send(JSON.stringify({roleId: options.roleId}))
		.expect(200, function (err, res) {
			expect(err).to.not.exist;
			expect(res).to.exist;
			expect(res.body).to.exist;
			expect(res.body).to.have.property('id');
			cb(res.body.id);
		});
	};

	it('feed role ACL should be removed when associated feed is deleted', function (done) {
		Helper.insertValidAtomicFeed(adminToken, function (atomicId, atomicFieldId) {
			insertFeedRoleAcl(adminToken, {
				feedType: 'atomic',
				feedId: atomicId,
				roleId: clientRoleId
			}, function (roleAclId) {
				Helper.cleanAllAtomicFeeds(adminToken, function () {
					var FeedRoleACL = app.models.FeedRoleACL;
					FeedRoleACL.find(function (err, acls) {
						expect(err).to.not.exist;
						expect(acls).to.exist;
						expect(acls).to.have.length(0);
						done();
					});
				});
			});
		});
	});

	it('should be forbidden for non authenticated users', function(done) {
		request(app)
		.get('/api/feeds')
		.expect(401, done);
	});

	it('not allowed user shouldn\'t be able to access a feed', function (done) {
		Helper.insertValidAtomicFeed(adminToken, function (atomicId, atomicFieldId) {
			request(app)
			.get('/api/feeds/atomic/'+atomicId)
			.set('Authorization', clientToken)
			.expect(404, done);
		});
	});

	it('users should see only the feeds that they are allowed to access', function (done) {
		Helper.insertValidAtomicFeed(adminToken, function (adminAtomicId, adminAtomicFieldId) {
			Helper.insertValidAtomicFeed(adminToken, function (clientAtomicId, clientAtomicFieldId) {
				insertFeedRoleAcl(adminToken, {
					feedType: 'atomic',
					feedId: clientAtomicId,
					roleId: clientRoleId
				}, function (roleAclId) {
					request(app)
					.get('/api/feeds/atomic/count')
					.set('Authorization', clientToken)
					.expect(200, function (err, res) {
						expect(err).to.not.exist;
						expect(res).to.exist;
						expect(res.body).to.exist;
						expect(res.body.count).to.equal(1);
						done();
					});
				});
			});
		});
	});

	it('allowed user should be able to access a feed', function (done) {
		Helper.insertValidAtomicFeed(adminToken, function (atomicId, atomicFieldId) {
			insertFeedRoleAcl(adminToken, {
				feedType: 'atomic',
				feedId: atomicId,
				roleId: clientRoleId
			}, function (roleAclId) {
				request(app)
				.get('/api/feeds/atomic/'+atomicId)
				.set('Authorization', clientToken)
				.expect(200, done);
			});
		});
	});

});
