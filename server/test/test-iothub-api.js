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

	it("Authenticated request by admin", function(done) {

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
		var reqP = User.login({username, password}).then((token) => {
			return makeRequest(token.id).then(() => User.logout(token.id));
		});
		expect(reqP).to.be.fulfilled.and.notify(done);
	});
});


describe('IoT Hub API, Authenticated', function() {

	var token;

	before(function(done) {
		var User = app.models.User;
		var reqP = User.login({username, password}).then((res) => {
			token = res.id;
		});
		expect(reqP).to.be.fulfilled.and.notify(done);
	});

	after(function(done) {
		var User = app.models.User;
		expect(User.logout(token)).to.be.fulfilled.and.notify(done);
	});

	describe('Fields', function () {

		beforeEach(function (done) {
			expect(Helper.cleanAllAtomicFeeds(token)).to.be.fulfilled.and.notify(done);
		});

		after(function (done) {
			expect(Helper.cleanAllAtomicFeeds(token)).to.be.fulfilled.and.notify(done);
		});

		it('Should find a previously inserted field', function(done) {
			var reqP = Helper.insertValidAtomicFeed(token).then((args) => {
				var fieldId = args[1];
				return app.models.Field.find().then((fields) => {
					expect(fields).to.have.length(1);
					expect(fields[0].getId()).to.equal(fieldId);
				});
			});
			expect(reqP).to.be.fulfilled.and.notify(done);
		});

	});

	describe('Atomic feeds', function() {

		beforeEach(function(done) {
			expect(Helper.cleanAllAtomicFeeds(token)).to.be.fulfilled.and.notify(done);
		});

		after(function(done) {
			expect(Helper.cleanAllAtomicFeeds(token)).to.be.fulfilled.and.notify(done);
		});

		it('Valid atomic feed', function(done) {
			expect(Helper.insertValidAtomicFeed(token)).to.be.fulfilled.and.notify(done);
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
			var reqP = Helper.insertValidAtomicFeed(token).then((args) => {
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
			expect(reqP).to.be.fulfilled.and.notify(done);
		});

		it('Should delete a previously inserted feed', function (done) {
			var reqP = Helper.insertValidAtomicFeed(token).then((args) => {
				var insertedId = args[0];
				return Helper.deleteFields(token, {
					feedType: 'atomic',
					id: insertedId,
					fieldProperty: 'field'
				}).then(() => {
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
			}).then(() => Helper.getFeedsOfType(token, 'atomic')).then((feeds) => {
				expect(feeds).to.have.length(0);
			});
			expect(reqP).to.be.fulfilled.and.notify(done);
		});

	});

	describe("Composed feeds", function() {

		beforeEach(function(done) {
			expect(Helper.cleanAllComposedFeeds(token)).to.be.fulfilled.and.notify(done);
		});

		after(function(done) {
			expect(Helper.cleanAllComposedFeeds(token)).to.be.fulfilled.and.notify(done);
		});

		it("Valid composed feed", function(done) {
			expect(Helper.insertValidComposedFeed(token)).to.be.fulfilled.and.notify(done);
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
			var reqP = Helper.insertValidComposedFeed(token).then((args) => {
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
			expect(reqP).to.be.fulfilled.and.notify(done);
		});

		it('Should delete a previously inserted feed', function (done) {
			var reqP = Helper.insertValidComposedFeed(token).then((args) => {
				var insertedId = args[0];
				return new Promise((resolve, reject) => {
					request(app)
					.delete(`/api/feeds/composed/${insertedId}`)
					.set('Authorization', token)
					.expect(200, function (err, res) {
						if (err) reject(err);
						resolve();
					});
				});
			}).then(() => Helper.getFeedsOfType(token, 'composed')).then((feeds) => {
				expect(feeds).to.have.length(0);
			});
			expect(reqP).to.be.fulfilled.and.notify(done);
		});

	});

	describe('Executable feeds', function() {

		beforeEach(function(done) {
			expect(Helper.cleanAllExecutableFeeds(token)).to.be.fulfilled.and.notify(done);
		});

		after(function(done) {
			expect(Helper.cleanAllExecutableFeeds(token)).to.be.fulfilled.and.notify(done);
		});

		it("Valid executable feed", function(done) {
			expect(Helper.insertValidExecutableFeed(token)).to.be.fulfilled.and.notify(done);
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
			var reqP = Helper.insertValidExecutableFeed(token).then((insertedId) => {
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
			expect(reqP).to.be.fulfilled.and.notify(done);
		});

		it('Should delete a previously inserted feed', function (done) {
			var reqP = Helper.insertValidExecutableFeed(token).then((insertedId) => {
				return new Promise((resolve, reject) => {
					request(app)
					.delete(`/api/feeds/executable/${insertedId}`)
					.set('Authorization', token)
					.expect(200, (err, res) => {
						if (err) reject(err);
						resolve();
					});
				});
			}).then(() => Helper.getFeedsOfType(token, 'executable')).then((feeds) => {
				expect(feeds).to.have.length(0);
			});
			expect(reqP).to.be.fulfilled.and.notify(done);
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

		beforeEach(function (done) {
			expect(cleanAllFeeds(token)).to.be.fulfilled.and.notify(done);
		});

		after(function(done) {
			expect(cleanAllFeeds(token)).to.be.fulfilled.and.notify(done);
		});

		it('Basic empty response for all feeds', function(done) {
			var reqP = getAllFeeds(token).then((body) => {
				expect(body).to.eql({count: 0, types: []});
			});
			expect(reqP).to.be.fulfilled.and.notify(done);
		});

		it('Getting all types of feeds after insertion', function(done) {
			var reqP = Helper.insertValidAtomicFeed(token)
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
			expect(reqP).to.be.fulfilled.and.notify(done);
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
		var reqP = User.login({username, password}).then((res) => {
			adminToken = res.id;
			// Create client role
			return new Promise((resolve, reject) => {
				Role.create({name: 'client'}, (err, role) => {
					if (err) reject(err);
					resolve(role);
				});
			});
		}).then((role) => {
			clientRoleId = role.id;
			// Create a user and associate it to the client role
			return User.create({
				username: clientUsername,
				email: clientUsername+'@hub.fi',
				password: clientPassword
			}).then((user) => {
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
		}).then(() => {
			// Log client in
			return User.login({
				username: clientUsername,
				password: clientPassword
			});
		}).then((token) => {
			clientToken = token.id;
		});
		expect(reqP).to.be.fulfilled.and.notify(done);
	});

	beforeEach(function (done) {
		expect(Helper.cleanAllAtomicFeeds(adminToken)).to.be.fulfilled.and.notify(done);
	});

	after(function(done) {
		var User = app.models.User;
		var reqP = Helper.cleanAllAtomicFeeds(adminToken)
		.then(() => User.logout(clientToken))
		.then(() => User.logout(adminToken));
		expect(reqP).to.be.fulfilled.and.notify(done);
	});

	var insertFeedRoleAcl = function (token, options) {
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

	it('feed role ACL should be removed when associated feed is deleted', function (done) {
		var reqP = Helper.insertValidAtomicFeed(adminToken).then((args) => {
			var atomicId = args[0];
			return insertFeedRoleAcl(adminToken, {
				feedType: 'atomic',
				feedId: atomicId,
				roleId: clientRoleId
			});
		}).then(() => Helper.cleanAllAtomicFeeds(adminToken)).then(() => app.models.FeedRoleACL.find()).then((acls) => {
			expect(acls).to.have.length(0);
		});
		expect(reqP).to.be.fulfilled.and.notify(done);
	});

	it('should be forbidden for non authenticated users', function(done) {
		request(app)
		.get('/api/feeds')
		.expect(401, done);
	});

	it('not allowed user shouldn\'t be able to access a feed', function (done) {
		var reqP = Helper.insertValidAtomicFeed(adminToken).then((args) => {
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
		expect(reqP).to.be.fulfilled.and.notify(done);
	});

	it('users should see only the feeds that they are allowed to access', function (done) {
		var reqP = Helper.insertValidAtomicFeed(adminToken)
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
		expect(reqP).to.be.fulfilled.and.notify(done);
	});

	it('allowed user should be able to access a feed', function (done) {
		var reqP = Helper.insertValidAtomicFeed(adminToken)
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
		expect(reqP).to.be.fulfilled.and.notify(done);
	});

});
