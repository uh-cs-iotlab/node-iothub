'use strict';

var request = require('supertest-as-promised');

module.exports = (app) => ({

    validComposedFeed(options) {
        return Object.assign({
            name: 'testFeed',
            keywords: [],
            metadata: ''
        }, options);
    },

    insertValidComposedFeed(token, options) {
        options = options || {};
        let fields = null;
        if(options.hasOwnProperty('fields')) {
            fields = options.fields;
            delete options.fields;
        }
        let feed = this.validComposedFeed(options);
        return request(app)
        .post('/api/feeds/composed')
        .set('Authorization', token)
        .type('json')
        .send(JSON.stringify(feed))
        .expect(200)
        .then((res) => {
            let composedFeedId = res.body.id;
            let fieldIdOptions = {
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
                let fieldOptions = (typeof fields === 'object' && fields != null ? fields : {});
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
    }

});