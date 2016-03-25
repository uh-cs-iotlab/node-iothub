'use strict';

var request = require('supertest');
var fs = require('fs');

module.exports = (app) => {

    return {
        createUser(userCreds, roleWhere) {
            return app.models.HubUser.create(userCreds)
            .then((user) => {
                if (roleWhere) {
                    return new Promise((resolve, reject) => {
                        app.models.HubRole.findOne({where: roleWhere}, (err, role) => {
                            if (err) reject(err);
                            resolve(role);
                        });
                    })
                    .then((role) => {
                        return new Promise((resolve, reject) => {
                            role.principals.create({
                                principalType: app.models.RoleMapping.USER,
                                principalId: user.id
                            }, (err, principal) => {
                                if (err) reject(err);
                                resolve(principal);
                            });
                        });
                    })
                    .then(() => user);
                } else {
                    return user;
                }
            });
        },
        login(userCreds) {
            return app.models.HubUser.login(userCreds);
        },
        removeUser(userId, tokenId) {
            var userP = Promise.resolve();
            if (tokenId) {
                userP = app.models.HubUser.logout(tokenId);
            }
            return userP
            .then(() => app.models.HubUser.destroyById(userId));
        },

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
                type: 'root/temperature',
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
        validComposedFeed(options) {
            return Object.assign({
                name: 'testFeed',
                keywords: [],
                metadata: ''
            }, options);
        },
        insertValidComposedFeed(token, options) {
            options = options || {};
            var fields = null;
            if(options.hasOwnProperty('fields')) {
                fields = options.fields;
                delete options.fields;
            }
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
                var fieldIdOptions = {
                    feedType: 'composed',
                    id: composedFeedId,
                    fieldProperty: 'fields'
                };
                if (Array.isArray(fields)) {
                    return Promise.all(fields.map((fieldOptions) => {
                        return this.insertValidField(token, fieldIdOptions, fieldOptions);
                    }))
                    .then(fieldIds => Promise.resolve([composedFeedId, fieldIds]));
                } else {
                    var fieldOptions = (typeof fields === 'object' && fields != null ? fields : {});
                    if (!fieldOptions.hasOwnProperty('required')) fieldOptions.required = true;
                    return this.insertValidField(token, fieldIdOptions, fieldOptions)
                    .then(fieldId => Promise.resolve([composedFeedId, fieldId]));
                }
            });
        },
        cleanAllComposedFeeds(token, options) {
            options = options || {};
            return this.getFeedsOfType(token, 'composed')
            .then(feeds => Promise.all(feeds.map(feed => this.deleteFeed(token, {
                type: 'composed',
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
        }, 

        // Adding helpers for IoT Hub Plugins
        getPlugins(token, options) {
            options = options || {};
            var url = `/api/plugins`;
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
        deletePlugin(token, options) {
            var url = `/api/plugins/${options.id}`;
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
        cleanAllPlugins(token, options) {
            options = options || {};
            return this.getPlugins(token, {})
            .then(plugins => Promise.all(plugins.map(plugin => this.deletePlugin(token, {
                id: plugin.id
            }))));
        },
        helloWorldPlugin() {
            var data = fs.readFileSync('server/test/resources/hello-world-plugin.js');
            var base64data = new Buffer(data).toString('base64');
            return {
                "name": "HelloWorldPlugin", // It has to match with the global object provided in the plugin
                "type": "iothub",
                "script": base64data, // The base64String of the code
                "isService": false
            };
        },
        invalidHelloWorldPlugin() {
            var data = fs.readFileSync('server/test/resources/invalid-hello-world-plugin.js');
            var base64data = new Buffer(data).toString('base64');
            return {
                "name": "HelloWorldPlugin", // It has to match with the global object provided in the plugin
                "type": "iothub",
                "script": base64data, // The base64String of the code
                "isService": false
            };
        }
    };
};
