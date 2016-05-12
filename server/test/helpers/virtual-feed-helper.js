'use strict';

var request = require('supertest-as-promised');

module.exports = (app) => ({

    virtualComposedMapping(feedId, options) {
        return Object.assign({feedId}, options);
    },

    insertVirtualComposedMapping(token, idOptions, options) {
        options = options || {};
        let mapping = this.virtualComposedMapping(idOptions.feedId, options);
        return request(app)
        .post(`/api/feeds/virtual/${idOptions.virtualId}/composed`)
        .set('Authorization', token)
        .type('json')
        .send(JSON.stringify(mapping))
        .expect(200)
        .then(res => res.body.id, (err) => {
            return Promise.reject(err);
        });
    },

    deleteVirtualComposedMapping(token, idOptions) {
        return request(app)
        .delete(`/api/feeds/virtual/${idOptions.virtualId}/composed/${idOptions.mappingId}`)
        .set('Authorization', token)
        .expect(204)
        .then(res => res.body, (err) => {
            return Promise.reject(err);
        });
    },

    virtualFeed(options) {
        return Object.assign({
            name: "aVirtualFeed"
        }, options);
    },

    insertVirtualFeed(token, options) {
        options = options || {};
        let feed = this.virtualFeed(options);
        return request(app)
        .post(`/api/feeds/virtual`)
        .set('Authorization', token)
        .type('json')
        .send(JSON.stringify(feed))
        .expect(200)
        .then(res => res.body.id, (err) => {
            return Promise.reject(err);
        });
    },

    deleteVirtualFeed(token, virtualId) {
        return request(app)
        .delete(`/api/feeds/virtual/${virtualId}`)
        .set('Authorization', token)
        .expect(200)
        .then(res => res.body, (err) => {
            return Promise.reject(err);
        });
    }
});