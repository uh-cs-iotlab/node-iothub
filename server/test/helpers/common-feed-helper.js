'use strict';

var request = require('supertest-as-promised');

module.exports = (app) => ({

    getFeedsOfType(token, type, options) {
        options = options || {};
        let url = `/api/feeds/${type}`;
        if (options.filtered) {
            url += '/filtered';
        }
        if (options.id) {
            url += `/${options.id}`;
        }
        return request(app)
        .get(url)
        .set('Authorization', token)
        .expect(200)
        .then(res => res.body);
    },

    deleteFeed(token, options) {
        let url = `/api/feeds/${options.type}/${options.id}`;
        if (options.force) url += '/force';
        return request(app)
        .delete(url)
        .set('Authorization', token)
        .expect(200)
        .then(res => res.body);
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
        let field = this.validField(options);
        return request(app)
        .post(`/api/feeds/${idOptions.feedType}/${idOptions.id}/${idOptions.fieldProperty}`)
        .set('Authorization', token)
        .type('json')
        .send(JSON.stringify(field))
        .expect(200)
        .then(res => res.body.id);
    },

    deleteFields(token, idOptions) {
        return request(app)
        .delete(`/api/feeds/${idOptions.feedType}/${idOptions.id}/${idOptions.fieldProperty}`)
        .set('Authorization', token)
        .expect(204)
        .then(res => res.body);
    }

});