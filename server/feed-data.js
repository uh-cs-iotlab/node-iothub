'use strict';

var loopback = require('loopback');
var FeedTypes = require('./feed-types.json');
var FieldTypes = require('./field-types');

module.exports = {

    feedDataCollectionName(Model, instanceId) {
        return `${Model.modelName}Data${instanceId}`;
    },

    create(Model, feedInstance, createOptions) {
        var self = this;
        if (createOptions.type === FeedTypes.EXECUTABLE) {
            return Promise.reject(new Error('ExecutableFeed has no storage capabilities.'));
        } else {
            return new Promise((resolve, reject) => {
                Model.getApp((err, app) => {
                    if (err) reject(err);
                    resolve(app);
                });
            })
            .then((app) => {
                var fieldDescriptions;
                switch (createOptions.type) {
                    case FeedTypes.ATOMIC:
                        if (!feedInstance._field) {
                            var atomicErr = new Error(`Model "${Model.modelName}" can't be validated, invalid "field" property (${feedInstance._field}).`);
                            atomicErr.statusCode = atomicErr.status = 422;
                            atomicErr.name = 'Validation Error';
                            return Promise.reject(atomicErr);
                        }
                        fieldDescriptions = [feedInstance._field];
                        break;
                    case FeedTypes.COMPOSED:
                        if (!feedInstance._fields || feedInstance._fields.length === 0) {
                            var composedErr = new Error(`Model "${Model.modelName}" can't be validated, invalid "fields" property (${feedInstance._fields}).`);
                            composedErr.statusCode = composedErr.status = 422;
                            composedErr.name = 'Validation Error';
                            return Promise.reject(composedErr);
                        }
                        fieldDescriptions = feedInstance._fields;
                        break;
                }
                var fieldDescriptionsByName = {};
                var properties = {date: {type: 'Date', required: true}};
                for (var field of fieldDescriptions) {
                    properties[field.name] = {
                        type: 'object',
                        required: field.required
                    };
                    fieldDescriptionsByName[field.name] = {
                        type: field.type,
                        required: field.required
                    };
                }
                var options = {
                    strict: true,
                };

                var FeedData = loopback.PersistedModel.extend(self.feedDataCollectionName(Model, feedInstance.getId()), properties, options);
                FeedData.observe('before save', function (ctx, next) {
                    if (ctx.isNewInstance && ctx.instance) {
                        var properties = ctx.instance.toJSON();
                        for (var prop in properties) {
                            if (prop != 'date' && properties[prop]) {
                                var fieldDesc = fieldDescriptionsByName[prop];
                                if (fieldDesc && !FieldTypes.isValid(fieldDesc.type, ctx.instance[prop])) {
                                    return FieldTypes.dataFormat(fieldDesc.type)
                                    .then((schema) => {
                                        var errValidation = new Error(`Invalid data. Wrong type for "${prop}" field. "${JSON.stringify(schema)}" expected.`);
                                        errValidation.statusCode = errValidation.status = 422;
                                        next(errValidation);

                                    }, (err) => next(err));
                                }
                            }
                        }
                        ctx.instance.date = (ctx.instance.date ? new Date(ctx.instance.date) : new Date());
                    }
                    next();
                });
                return app.model(FeedData, {dataSource: 'db', public: false});
            });
        }
    },

    insert(Model, data, options) {
        var DataCollection = Model.registry.findModel(this.feedDataCollectionName(Model, options.modelId));
        if (!DataCollection) return Promise.reject(new Error(`No data collection found for "${Model.modelName}" id "${options.modelId}".`));
        return DataCollection.create(data);
    },

    get(Model, options) {
        options.filter = options.filter || {limit: 100};
        var DataCollection = Model.registry.findModel(this.feedDataCollectionName(Model, options.modelId));
        if (!DataCollection) return Promise.reject(new Error(`No data collection found for "${Model.modelName}" id "${options.modelId}".`));
        return DataCollection.find(options.filter);
    },

    getChangeStream(Model, options) {
        var DataCollection = Model.registry.findModel(this.feedDataCollectionName(Model, options.modelId));
        if (!DataCollection) return Promise.reject(new Error(`No data collection found for "${Model.modelName}" id "${options.modelId}".`));
        return new Promise((resolve, reject) => {
            DataCollection.createChangeStream((err, changes) => {
                if (err) reject(err);
                resolve(changes);
            });
        });

    }

};
