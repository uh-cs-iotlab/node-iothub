'use strict';

var request = require('supertest-as-promised');

module.exports = (app) => ({

    validateFeed(token, idOptions) {
        return request(app)
        .post(`/api/feeds/${idOptions.feedType}/${idOptions.id}/validate`)
        .set('Authorization', token)
        .expect(200)
        .then(res => res.body);
    },

    getData(token, idOptions, options) {
        options = options || {};
        let url = `/api/feeds/${idOptions.feedType}/${idOptions.id}/data`;
        if (options.filter) url += `?filter=${JSON.stringify(options.filter)}`;
        return request(app)
        .get(url)
        .set('Authorization', token)
        .expect(200)
        .then(res => res.body);
    },

    insertData(token, data, idOptions) {
        return request(app)
        .post(`/api/feeds/${idOptions.feedType}/${idOptions.id}/data`)
        .set('Authorization', token)
        .type('json')
        .send(JSON.stringify(data))
        .expect(200)
        .then(res => res.body);
    }

});