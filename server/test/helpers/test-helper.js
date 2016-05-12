'use strict';

var request = require('supertest');

var CommonFeedHelper = require('./common-feed-helper');
var ComposedFeedHelper = require('./composed-feed-helper');
var FeedDataHelper = require('./feed-data-helper');
var UserHelper = require('./user-helper');
var VirtualFeedHelper = require('./virtual-feed-helper');

module.exports = (app) => {

    return Object.assign(
        {},
        CommonFeedHelper(app),
        ComposedFeedHelper(app),
        FeedDataHelper(app),
        UserHelper(app),
        VirtualFeedHelper(app),
        {
            /*
                TODO
                These helpers should probably be deleted once they are not needed by tests.
                They have been written before the large refactoring of atomic and executable feeds.
             */
            validAtomicFeed(options) {
                return Object.assign({
                    name: 'testFeed',
                    keywords: [],
                    metadata: ''
                }, options);
            },

            insertValidAtomicFeed(token, options) {
                options = options || {};
                var feed = this.validAtomicFeed(options);
                return new Promise((resolve, reject) => {
                    request(app)
                    .post('/api/feeds/atomic')
                    .set('Authorization', token)
                    .type('json')
                    .send(JSON.stringify(feed))
                    .expect(200, (err, res) => {
                        if (err) reject(err);
                        resolve(res.body.id);
                    });
                })
                .then((atomicFeedId) => {
                    return this.insertValidField(token, {
                        feedType: 'atomic',
                        id: atomicFeedId,
                        fieldProperty: 'field'
                    }, {required: true})
                    .then(fieldId => Promise.resolve([atomicFeedId, fieldId]));
                });
            },

            cleanAllAtomicFeeds(token, options) {
                options = options || {};
                return this.getFeedsOfType(token, 'atomic')
                .then(feeds => Promise.all(feeds.map(feed => this.deleteFeed(token, {
                    type: 'atomic',
                    id: feed.id,
                    force: options.force
                }))));
            },

            validExecutableFeed(options) {
                return Object.assign({
                    name: 'testFeed',
                    metadata: '',
                    keywords: [],
                    source: '',
                    params: [],
                    readable: false,
                    writeable: false
                }, options);
            },

            insertValidExecutableFeed(token, options) {
                options = options || {};
                var feed = this.validExecutableFeed(options);
                return new Promise((resolve, reject) => {
                    request(app)
                    .post('/api/feeds/executable')
                    .set('Authorization', token)
                    .type('json')
                    .send(JSON.stringify(feed))
                    .expect(200, (err, res) => {
                        if (err) reject(err);
                        resolve(res.body.id);
                    });
                });
            },

            cleanAllExecutableFeeds(token) {
                return this.getFeedsOfType(token, 'executable')
                .then(feeds => Promise.all(feeds.map(feed => this.deleteFeed(token, {type: 'executable', id: feed.id}))));
            }
        }
    );
};
