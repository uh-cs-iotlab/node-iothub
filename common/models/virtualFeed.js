'use strict';

var FeedData = require('../utils/feed-data');
var FieldTypes = require('../utils/field-types');
var FeedTypes = require('../utils/feed-types');

module.exports = function (VirtualFeed) {

    VirtualFeed.mixin('BaseFeed', {type: FeedTypes.VIRTUAL});

    VirtualFeed.disableRemoteMethod('__build__composed', false);
    VirtualFeed.disableRemoteMethod('__updateById__composed', false);
    VirtualFeed.disableRemoteMethod('__add__composed', false);
    VirtualFeed.disableRemoteMethod('__set__composed', false);

    let ComposedFeedVirtualMapping = VirtualFeed.registry.findModel('ComposedFeedVirtualMapping');
    let feedModels = {
        [FeedTypes.COMPOSED]: VirtualFeed.registry.findModel(FeedTypes.getModelName(FeedTypes.COMPOSED))
    };

    VirtualFeed.beforeRemote('prototype.__create__composed', (ctx, result, next) => {
        let insertedMapping = ctx.args.data;
        ctx.instance.composed((err, composedMappings) => {
            if (err) return next(err);
            if (composedMappings.some(mapping => mapping.feedId === insertedMapping.feedId)) {
                let err = new Error(`ComposedFeed id "${insertedMapping.feedId}" already mapped to VirtualFeed id "${ctx.instance.getId()}"`);
                err.name = 'ValidationError';
                err.status = err.statusCode = 422;
                return next(err);
            }
            next();
        });
    });

    VirtualFeed.getDataFormat = function (modelId, cb) {
        let reqP = VirtualFeed.filteredFindById(modelId)
        .then((model) => {
            if (!model) {
                let err = new Error(`Unknown 'VirtualFeed' id '${modelId}'`);
                err.status = err.statusCode = 404;
                return Promise.reject(err);
            }
            let format = {};
            return new Promise((resolve, reject) => {
                model.composed((err, mappings) => {
                    if (err) reject(err);
                    resolve(mappings);
                });
            })
            .then((mappings) => {
                return Promise.all(mappings.map((mapping) => {
                    return ComposedFeedVirtualMapping.getFields(mapping)
                    .then((fields) => {
                        return Promise.all(fields.map((field) => {
                            return FieldTypes.dataFormat(field.type)
                            .then((schema) => {
                                format[`${mapping.name}/${field.name}`] = schema;
                            });
                        }));
                    });
                }));
            })
            .then(() => format);
        });
        if (cb) reqP.then((format) => cb(null, format), (err) => cb(err));
        return reqP;
    };
    VirtualFeed.remoteMethod(
        'getDataFormat',
        {
            description: 'Get data format for this feed',
            accessType: 'READ',
            accepts: {arg: 'id', type: 'string', required: true},
            returns: {arg: 'format', type: 'object', root: true},
            http: {verb: 'get', path: '/:id/data-format'}
        }
    );

    VirtualFeed.getData = function (modelId, filter, cb) {
        if (typeof filter === 'function' && cb === undefined) {
            // getData(modelId, cb)
            cb = filter;
            filter = {};
        }
        if (!filter) filter = {};
        filter = Object.assign(filter, {
            limit: 1
        });
        let reqP = VirtualFeed.filteredFindById(modelId)
        .then((model) => {
            if (!model) {
                let err = new Error(`Unknown 'VirtualFeed' id '${modelId}'`);
                err.status = err.statusCode = 404;
                return Promise.reject(err);
            }
            let retData = {};
            return new Promise((resolve, reject) => {
                model.composed((err, mappings) => {
                    if (err) reject(err);
                    resolve(mappings);
                });
            })
            .then((mappings) => {
                return Promise.all(mappings.map((mapping) => {
                    filter.fields = mapping.fields;
                    return FeedData.get(feedModels[FeedTypes.COMPOSED], {modelId: mapping.feedId, filter})
                    .then((data) => {
                        if (data.length === 0) {
                            data = {};
                        } else {
                            data = data[0].__data;
                            delete data.id;
                            delete data.date;
                        }
                        retData[mapping.name] = data;
                    });
                }));
            })
            .then(() => retData);
        });
        if (cb) reqP.then((data) => cb(null, data), (err) => cb(err));
        return reqP;
    };
    VirtualFeed.remoteMethod(
        'getData',
        {
            description: 'Get feed data with optional limit',
            accessType: 'READ',
            accepts: [
                {arg: 'id', type: 'string', required: true},
                {
                    arg: 'filter',
                    type: 'object',
                    description: 'Filter defining fields, where, include, order, offset, and limit'
                }
            ],
            returns: {arg: 'data', type: ['object'], root: true},
            http: {verb: 'get', path: '/:id/data'}
        }
    );

};