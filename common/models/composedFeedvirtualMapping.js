'use strict';

var FeedTypes = require('../utils/feed-types');

module.exports = function (Model) {

    let ComposedFeed = Model.registry.findModel(FeedTypes.getModelName(FeedTypes.COMPOSED));

    Model.getFields = (model) => {
        return ComposedFeed.findById(model.feedId)
        .then((feed) => {
            return feed._fields.filter(field => field.name in model.fields);
        });
    };

    let validatesFields = (feed, fields) => {
        return Promise.all(fields.map((fieldName) => {
            if (!feed._fields.some(field => field.name === fieldName)) {
                let err = new Error(`Field "${fieldName}" doesn't exist in ComposedFeed id "${feed.getId()}"`);
                err.name = 'ValidationError';
                err.status = err.statusCode = 422;
                return Promise.reject(err);
            }
        }));
    };

    Model.observe('before save', (ctx, next) => {
        // Verifies if the feed exists
        let hookP = Promise.resolve({exists: true});
        if (ctx.isNewInstance) {
            hookP = ComposedFeed.findById(ctx.instance.feedId)
            .then((feed) => {
                if (!feed) return {exists: false, feedId: ctx.instance.feedId};
                if (!feed.validated) {
                    let err = new Error(`ComposedFeed id "${feed.getId()}" must be validated`);
                    err.name = 'ValidationError';
                    err.status = err.statusCode = 422;
                    return Promise.reject(err);
                }
                if (!ctx.instance.name) ctx.instance.name = feed.name;
                return validatesFields(feed, ctx.instance.fields)
                .then(() => ({exists: true}));
            })
        } else if (ctx.data.hasOwnProperty('feedId')) {
            hookP = ComposedFeed.findById(ctx.data.feedId)
            .then((feed) => {
                if (!feed) return {exists: false, feedId: ctx.data.feedId};
                let fieldP = Promise.resolve();
                if (ctx.data.fields) {
                    fieldP = validatesFields(feed, ctx.data.fields);
                }
                return fieldP
                .then(() => ({exists: true}));
            });
        } else {
            let err = new Error('ComposedFeed id is undefined');
            err.name = 'ValidationError';
            err.status = err.statusCode = 422;
            hookP = Promise.reject(err);
        }
        hookP.then((existsObj) => {
            if (!existsObj.exists) {
                let err = new Error(`ComposedFeed id "${existsObj.feedId}" doesn't exist`);
                err.name = 'ValidationError';
                err.status = err.statusCode = 422;
                return next(err);
            }
            next();
        }, err => next(err));
    });

};