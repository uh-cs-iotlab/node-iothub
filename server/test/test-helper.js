var request = require('supertest');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;

module.exports = (app) => {

    return {
        getFeedsOfType(token, type, options) {
            options = options || {};
            var url = `/api/feeds/${type}`;
            if (options.filtered) {
                url += '/filtered';
            }
            if (options.id) {
                url += `/${options.id}`;
            }
            return new Promise((resolve, reject) => {
                request(app)
                .get(url)
                .set('Authorization', token)
                .expect(200, (err, res) => {
                    if (err) reject(err);
                    resolve(res.body);
                });
            });
        },
        deleteFeed(token, options) {
            var url = `/api/feeds/${options.type}/${options.id}`;
            if (options.force) url += '/force';
            return new Promise((resolve, reject) => {
                request(app)
                .delete(url)
                .set('Authorization', token)
                .expect(200, (err, res) => {
                    if (err) reject(err);
                    resolve(res.body);
                });
            });
        },

        validField(options) {
            return Object.assign({
                name: 'testField',
                type: 'temperature',
                metadata: '',
                required: false,
                keywords: []
            }, options);
        },
        insertValidField(token, idOptions, options) {
            options = options || {};
            var field = this.validField(options);
            return new Promise((resolve, reject) => {
                request(app)
                .post(`/api/feeds/${idOptions.feedType}/${idOptions.id}/${idOptions.fieldProperty}`)
                .set('Authorization', token)
                .type('json')
                .send(JSON.stringify(field))
                .expect(200, (err, res) => {
                    if (err) reject(err);
                    resolve(res.body.id);
                });
            });
        },
        deleteFields(token, idOptions) {
            return new Promise((resolve, reject) => {
                request(app)
                .delete(`/api/feeds/${idOptions.feedType}/${idOptions.id}/${idOptions.fieldProperty}`)
                .set('Authorization', token)
                .expect(204, (err, res) => {
                    if (err) reject(err);
                    resolve(res.body);
                });
            });
        },

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
                })
                .then(fieldId => Promise.resolve([atomicFeedId, fieldId]));
            });
        },
        cleanAllAtomicFeeds(token, options) {
            options = options || {};
            return this.getFeedsOfType(token, 'atomic')
            .then(feeds => Promise.all(feeds.map(feed => this.deleteFeed(token, {type: 'atomic', id: feed.id, force: options.force}))));
        },

        validComposedFeed(options) {
            return Object.assign({
                name: 'testFeed',
                readable: false,
                writeable: false,
                storage: false,
                keywords: [],
                metadata: ''
            }, options);
        },
        insertValidComposedFeed(token, options) {
            options = options || {};
            var feed = this.validComposedFeed(options);
            return new Promise((resolve, reject) => {
                request(app)
                .post('/api/feeds/composed')
                .set('Authorization', token)
                .type('json')
                .send(JSON.stringify(feed))
                .expect(200, (err, res) => {
                    if (err) reject(err);
                    resolve(res.body.id);
                });
            })
            .then((composedFeedId) => {
                return this.insertValidField(token, {
                    feedType: 'composed',
                    id: composedFeedId,
                    fieldProperty: 'fields'
                })
                .then(fieldId => Promise.resolve([composedFeedId, fieldId]));
            });
        },
        cleanAllComposedFeeds(token, options) {
            options = options || {};
            return this.getFeedsOfType(token, 'composed')
            .then(feeds => Promise.all(feeds.map(feed => this.deleteFeed(token, {type: 'composed', id: feed.id, force: options.force}))));
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
        },

        validateFeed(token, idOptions) {
            return new Promise((resolve, reject) => {
                request(app)
                .post(`/api/feeds/${idOptions.feedType}/${idOptions.id}/validate`)
                .set('Authorization', token)
                .expect(200, (err, res) => {
                    if (err) reject(err);
                    resolve(res.body);
                });
            });
        },

        getData(token, idOptions, options) {
            options = options || {};
            var url = `/api/feeds/${idOptions.feedType}/${idOptions.id}/data`;
            if (options.filter) url += `?filter=${JSON.stringify(options.filter)}`;
            return new Promise((resolve, reject) => {
                request(app)
                .get(url)
                .set('Authorization', token)
                .expect(200, (err, res) => {
                    if (err) reject(err);
                    resolve(res.body);
                });
            });
        },

        insertData(token, data, idOptions) {
            return new Promise((resolve, reject) => {
                request(app)
                .post(`/api/feeds/${idOptions.feedType}/${idOptions.id}/data`)
                .set('Authorization', token)
                .type('json')
                .send(JSON.stringify(data))
                .expect(200, (err, res) => {
                    if (err) reject(err);
                    resolve(res.body);
                });
            });
        }
    };
};
