var app = require('../server');
var Helper = require('./test-helper')(app);

var request = require('supertest');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;

var username = 'username', password = 'password';

describe("IoT Hub API, Authentication", function() {

	it("Non autenticated request should be rejected by default", function(done) {
		request(app)
		.get('/api/feeds')
		.expect(401, done);
	});

	it("Authenticated request by admin", function() {

		var makeRequest = function(token) {
			return new Promise((resolve, reject) => {
				request(app)
				.get('/api/feeds')
				.set('Authorization', token)
				.expect(200, (err, res) => {
					if (err) reject(err);
					resolve(res.body);
				});
			});
		};

		var User = app.models.User;
		return User.login({username, password})
		.then((token) => {
			return makeRequest(token.id)
			.then(() => User.logout(token.id));
		});
	});
});


describe('IoT Hub API, Authenticated', function() {

	var token;

	before(function() {
		var User = app.models.User;
		return User.login({username, password})
		.then((res) => {
			token = res.id;
		});
	});

	after(function() {
		var User = app.models.User;
		return User.logout(token);
	});

	describe('Fields', function() {

		beforeEach(function() {
			return Helper.cleanAllAtomicFeeds(token);
		});

		after(function() {
			return Helper.cleanAllAtomicFeeds(token);
		});

		it('Should find a previously inserted field', function() {
			return Helper.insertValidAtomicFeed(token)
			.then((args) => {
				var fieldId = args[1];
				return app.models.Field.find()
				.then((fields) => {
					expect(fields).to.have.length(1);
					expect(fields[0].getId()).to.equal(fieldId);
				});
			});
		});

	});

	describe('Atomic feeds', function() {

		beforeEach(function() {
			return Helper.cleanAllAtomicFeeds(token);
		});

		after(function() {
			return Helper.cleanAllAtomicFeeds(token);
		});

		it('Valid atomic feed', function() {
			return Helper.insertValidAtomicFeed(token);
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

		it('Should find a previously inserted feed', function() {
			return Helper.insertValidAtomicFeed(token)
			.then((args) => {
				var insertedId = args[0],
					fieldId = args[1];
				return new Promise((resolve, reject) => {
					request(app)
					.get(`/api/feeds/atomic/${insertedId}`)
					.set('Authorization', token)
					.expect(200, (err, res) => {
						if (err) reject(err);
						expect(res.body).to.eql(Helper.validAtomicFeed({
							id: insertedId,
							_field: Helper.validField({ id: fieldId })
						}));
						resolve();
					});
				});
			});
		});

		it('Should delete a previously inserted feed', function() {
			return Helper.insertValidAtomicFeed(token)
			.then((args) => {
				var insertedId = args[0];
				return Helper.deleteFields(token, {
					feedType: 'atomic',
					id: insertedId,
					fieldProperty: 'field'
				})
				.then(() => {
					return new Promise((resolve, reject) => {
						request(app)
						.delete(`/api/feeds/atomic/${insertedId}`)
						.set('Authorization', token)
						.expect(200, (err, res) => {
							if (err) reject(err);
							resolve();
						});
					});
				});
			})
			.then(() => Helper.getFeedsOfType(token, 'atomic'))
			.then((feeds) => {
				expect(feeds).to.have.length(0);
			});
		});

	});

	describe("Composed feeds", function() {

		beforeEach(function() {
			return Helper.cleanAllComposedFeeds(token);
		});

		after(function() {
			return Helper.cleanAllComposedFeeds(token);
		});

		it("Valid composed feed", function() {
			return Helper.insertValidComposedFeed(token);
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

		it('Should find a previously inserted feed', function() {
			return Helper.insertValidComposedFeed(token)
			.then((args) => {
				var insertedId = args[0],
					fieldId = args[1];
				return new Promise((resolve, reject) => {
					request(app)
					.get(`/api/feeds/composed/${insertedId}`)
					.set('Authorization', token)
					.expect(200, (err, res) => {
						if (err) reject(err);
						expect(res.body).to.eql(Helper.validComposedFeed({
							id: insertedId,
							_fields: [
								Helper.validField({ id: fieldId })
							]
						}));
						resolve();
					});
				});
			});
		});

		it('Should delete a previously inserted feed', function() {
			return Helper.insertValidComposedFeed(token)
			.then((args) => {
				var insertedId = args[0];
				return new Promise((resolve, reject) => {
					request(app)
					.delete(`/api/feeds/composed/${insertedId}`)
					.set('Authorization', token)
					.expect(200, function(err, res) {
						if (err) reject(err);
						resolve();
					});
				});
			})
			.then(() => Helper.getFeedsOfType(token, 'composed'))
			.then((feeds) => {
				expect(feeds).to.have.length(0);
			});
		});

	});

	describe('Executable feeds', function() {

		beforeEach(function() {
			return Helper.cleanAllExecutableFeeds(token);
		});

		after(function() {
			return Helper.cleanAllExecutableFeeds(token);
		});

		it("Valid executable feed", function() {
			return Helper.insertValidExecutableFeed(token);
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

		it('Should find a previously inserted feed', function() {
			return Helper.insertValidExecutableFeed(token)
			.then((insertedId) => {
				return new Promise((resolve, reject) => {
					request(app)
					.get(`/api/feeds/executable/${insertedId}`)
					.set('Authorization', token)
					.expect(200, (err, res) => {
						if (err) reject(err);
						expect(res.body).to.eql(Helper.validExecutableFeed({
							id: insertedId
						}));
						resolve();
					});
				});
			});
		});

		it('Should delete a previously inserted feed', function() {
			return Helper.insertValidExecutableFeed(token)
			.then((insertedId) => {
				return new Promise((resolve, reject) => {
					request(app)
					.delete(`/api/feeds/executable/${insertedId}`)
					.set('Authorization', token)
					.expect(200, (err, res) => {
						if (err) reject(err);
						resolve();
					});
				});
			})
			.then(() => Helper.getFeedsOfType(token, 'executable'))
			.then((feeds) => {
				expect(feeds).to.have.length(0);
			});
		});

	});

	describe('General querying', function() {

		var getAllFeeds = function(token) {
			return new Promise((resolve, reject) => {
				request(app)
				.get('/api/feeds')
				.set('Authorization', token)
				.expect(200, function(err, res) {
					if (err) reject(err);
					resolve(res.body);
				});
			});
		};

		var cleanAllFeeds = function(token) {
			return Promise.all([
				Helper.cleanAllAtomicFeeds(token),
				Helper.cleanAllComposedFeeds(token),
				Helper.cleanAllExecutableFeeds(token)
			]);
		};

		beforeEach(function() {
			return cleanAllFeeds(token);
		});

		after(function() {
			return cleanAllFeeds(token);
		});

		it('Basic empty response for all feeds', function() {
			return getAllFeeds(token)
			.then((body) => {
				expect(body).to.eql({count: 0, types: []});
			});
		});

		it('Getting all types of feeds after insertion', function() {
			return Helper.insertValidAtomicFeed(token)
			.then((atomicArgs) => {
				var atomicId = atomicArgs[0],
					atomicFieldId = atomicArgs[1];
				return Helper.validateFeed(token, {feedType: 'atomic', id: atomicId})
				.then(() => Helper.insertValidComposedFeed(token))
				.then((composedArgs) => {
					var composedId = composedArgs[0],
						composedFieldId = composedArgs[1];
					return Helper.validateFeed(token, {feedType: 'composed', id: composedId})
					.then(() => Helper.insertValidExecutableFeed(token))
					.then((executableId) => {
						return getAllFeeds(token)
						.then((body) => {
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

	before(function() {
		var User = app.models.User;
		var Role = app.models.Role;
		var RoleMapping = app.models.RoleMapping;
		return User.login({username, password})
		.then((res) => {
			adminToken = res.id;
			// Create client role
			return new Promise((resolve, reject) => {
				Role.create({name: 'client'}, (err, role) => {
					if (err) reject(err);
					resolve(role);
				});
			});
		})
		.then((role) => {
			clientRoleId = role.id;
			// Create a user and associate it to the client role
			return User.create({
				username: clientUsername,
				email: clientUsername+'@hub.fi',
				password: clientPassword
			})
			.then((user) => {
				return new Promise((resolve, reject) => {
					role.principals.create({
						principalType: RoleMapping.USER,
						principalId: user.id
					}, (err, principal) => {
						if (err) reject(err);
						resolve();
					});
				});
			});
		})
		.then(() => {
			// Log client in
			return User.login({
				username: clientUsername,
				password: clientPassword
			});
		})
		.then((token) => {
			clientToken = token.id;
		});
	});

	beforeEach(function() {
		return Helper.cleanAllAtomicFeeds(adminToken);
	});

	after(function() {
		var User = app.models.User;
		return Helper.cleanAllAtomicFeeds(adminToken)
		.then(() => User.logout(clientToken))
		.then(() => User.logout(adminToken));
	});

	var insertFeedRoleAcl = function(token, options) {
		return new Promise((resolve, reject) => {
			request(app)
			.post(`/api/feeds/${options.feedType}/${options.feedId}/role-acl`)
			.set('Authorization', token)
			.type('json')
			.send(JSON.stringify({roleId: options.roleId}))
			.expect(200, (err, res) => {
				if (err) reject(err);
				resolve(res.body.id);
			});
		});
	};

	it('feed role ACL should be removed when associated feed is deleted', function() {
		return Helper.insertValidAtomicFeed(adminToken)
		.then((args) => {
			var atomicId = args[0];
			return insertFeedRoleAcl(adminToken, {
				feedType: 'atomic',
				feedId: atomicId,
				roleId: clientRoleId
			});
		})
		.then(() => Helper.cleanAllAtomicFeeds(adminToken))
		.then(() => app.models.FeedRoleACL.find())
		.then((acls) => {
			expect(acls).to.have.length(0);
		});
	});

	it('should be forbidden for non authenticated users', function(done) {
		request(app)
		.get('/api/feeds')
		.expect(401, done);
	});

	it('not allowed user shouldn\'t be able to access a feed', function() {
		return Helper.insertValidAtomicFeed(adminToken)
		.then((args) => {
			var atomicId = args[0];
			return new Promise((resolve, reject) => {
				request(app)
				.get(`/api/feeds/atomic/filtered/${atomicId}`)
				.set('Authorization', clientToken)
				.expect(404, (err, res) => {
					if (err) reject(err);
					resolve();
				});
			});
		});
	});

	it('users should see only the feeds that they are allowed to access', function() {
		return Helper.insertValidAtomicFeed(adminToken)
		.then(() => Helper.insertValidAtomicFeed(adminToken))
		.then((clientArgs) => {
			var clientAtomicId = clientArgs[0];
			return insertFeedRoleAcl(adminToken, {
				feedType: 'atomic',
				feedId: clientAtomicId,
				roleId: clientRoleId
			})
			.then(() => Helper.validateFeed(adminToken, {feedType: 'atomic', id: clientAtomicId}));
		})
		.then(() => {
			return new Promise((resolve, reject) => {
				request(app)
				.get('/api/feeds/atomic/filtered/count')
				.set('Authorization', clientToken)
				.expect(200, (err, res) => {
					if (err) reject(err);
					expect(res.body.count).to.equal(1);
					resolve(res.body.count);
				});
			});
		});
	});

	it('allowed user should be able to access a feed', function() {
		return Helper.insertValidAtomicFeed(adminToken)
		.then((args) => {
			var atomicId = args[0];
			return insertFeedRoleAcl(adminToken, {
					feedType: 'atomic',
					feedId: atomicId,
					roleId: clientRoleId
			})
			.then(() => Helper.validateFeed(adminToken, {feedType: 'atomic', id: atomicId}))
			.then(() => {
				return new Promise((resolve, reject) => {
					request(app)
					.get(`/api/feeds/atomic/filtered/${atomicId}`)
					.set('Authorization', clientToken)
					.expect(200, (err, res) => {
						if (err) reject(err);
						resolve(res.body);
					});
				});
			});
		});
	});

});
