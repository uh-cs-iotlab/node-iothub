var request = require('supertest');
var expect = require('chai').expect;
var async = require('async');

module.exports = function(app) {

    return {
        extend: function(inObject) {
        	var ret = new Object(inObject);
        	for(var i=1; i < arguments.length; i++) {
        		for(var key in arguments[i]) {
        			if(arguments[i][key]) {
        				ret[key] = arguments[i][key];
        			}
        		}
        	}
        	return ret;
        },

        getFeedsOfType: function(token, type, cb) {
            request(app)
            .get('/api/feeds/'+type)
            .set('Authorization', token)
            .expect(200, function (err, res) {
                expect(err).to.not.exist;
                expect(res).to.exist;
                expect(res.body).to.exist;
                cb(res.body);
            });
        },
        deleteFeed: function(token, options, cb) {
            request(app)
            .delete('/api/feeds/'+options.type+'/'+options.id)
            .set('Authorization', token)
            .expect(200, cb);
        },

        validField: function(options) {
            options = options || {};
            var ret = this.extend({
                name: '',
                type: '',
                metadata: '',
                optional: true,
                keywords: []
            }, options);
            return ret;
        },
        insertValidField: function(token, idOptions, options, cb) {
            var self = this;
            if (typeof options === 'function' && cb === undefined) {
                // insertValidField(idOptions, cb)
                cb = options;
                options = {};
            }
            var field = self.validField(options);
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
        },
        deleteFields: function(token, idOptions, cb) {
            request(app)
            .delete('/api/feeds/' + idOptions.feedType + '/' + idOptions.id + '/' + idOptions.fieldProperty)
            .set('Authorization', token)
            .expect(204, function (err, res) {
                expect(err).to.not.exist;
                expect(res).to.exist;
                cb();
            });
        },

        validAtomicFeed: function(options) {
            options = options || {};
            var ret = this.extend({
                name: 'testFeed',
                keywords: [],
                metadata: '',
                _field: {}
            }, options);
            return ret;
        },
        insertValidAtomicFeed: function(token, options, cb) {
            var self = this;
            if (typeof options === 'function' && cb === undefined) {
                // insertValidAtomicFeed(cb)
                cb = options;
                options = {};
            }
            var feed = self.validAtomicFeed(options);
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
                self.insertValidField(token, {
                    feedType: 'atomic',
                    id: res.body.id,
                    fieldProperty: 'field'
                }, function(fieldId) {
                    cb(res.body.id, fieldId);
                });
            });
        },
        cleanAllAtomicFeeds: function(token, cb) {
            var self = this;
            self.getFeedsOfType(token, 'atomic', function (feeds) {
                async.each(feeds, function(feed, callback) {
                    self.deleteFields(token, {
                        feedType: 'atomic',
                        id: feed.id,
                        fieldProperty: 'field'
                    }, function () {
                        self.deleteFeed(token, {type: 'atomic', id: feed.id} , callback);
                    });
                }, function(feedErr) {
                    expect(feedErr).to.not.exist;
                    cb();
                });
            });
        },

        validComposedFeed: function(options) {
            options = options || {};
            var ret = this.extend({
                name: 'testFeed',
                readable: false,
                writeable: false,
                storage: false,
                keywords: [],
                metadata: '',
                _fields: []
            }, options);
            return ret;
        },
        insertValidComposedFeed: function(token, options, cb) {
            var self = this;
            if (typeof options === 'function' && cb === undefined) {
                // insertValidComposedFeed(cb)
                cb = options;
                options = {};
            }
            var feed = self.validComposedFeed(options);
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
                self.insertValidField(token, {
                    feedType: 'composed',
                    id: res.body.id,
                    fieldProperty: 'fields'
                }, function(fieldId) {
                    cb(res.body.id, fieldId);
                });
            });
        },
        cleanAllComposedFeeds: function(token, cb) {
            var self = this;
            self.getFeedsOfType(token, 'composed', function (feeds) {
                async.each(feeds, function(feed, callback) {
                    self.deleteFields(token, {
                        feedType: 'composed',
                        id: feed.id,
                        fieldProperty: 'fields'
                    }, function () {
                        self.deleteFeed(token, {type: 'composed', id: feed.id}, callback);
                    });
                }, function(feedErr) {
                    expect(feedErr).to.not.exist;
                    cb();
                });
            });
        },

        validExecutableFeed: function (options) {
            options = options || {};
            var ret = this.extend({
                name: 'testFeed',
                metadata: '',
                keywords: [],
                source: '',
                params: [],
                readable: false,
                writeable: false
            }, options);
            return ret;
        },
        insertValidExecutableFeed: function (token, options, cb) {
            var self = this;
            if (typeof options === 'function' && cb === undefined) {
                // insertValidExecutableFeed(cb)
                cb = options;
                options = {};
            }
            var feed = self.validExecutableFeed(options);
            request(app)
            .post('/api/feeds/executable')
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
        },
        cleanAllExecutableFeeds: function (token, cb) {
            var self = this;
            self.getFeedsOfType(token, 'executable', function (feeds) {
                async.each(feeds, function(feed, callback) {
                    self.deleteFeed(token, {type: 'executable', id: feed.id}, callback);
                }, function(feedErr) {
                    expect(feedErr).to.not.exist;
                    cb();
                });
            });
        }
    };
};
