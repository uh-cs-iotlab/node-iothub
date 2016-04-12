'use strict';

var loopback = require('loopback');
var FeedTypes = require('./feed-types');
var FieldTypes = require('./field-types');

module.exports = {

    feedDataCollectionName(Model, instanceId) {
        return `${Model.modelName}Data${instanceId}`;
    },

    create(Model, feedInstance, createOptions) {
        let self = this;
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
                let fieldDescriptions;
                switch (createOptions.type) {
                    case FeedTypes.ATOMIC:
                        if (!feedInstance._field) {
                            let err = new Error(`Model "${Model.modelName}" can't be validated, invalid "field" property (${feedInstance._field}).`);
                            err.statusCode = err.status = 422;
                            err.name = 'Validation Error';
                            return Promise.reject(err);
                        }
                        fieldDescriptions = [feedInstance._field];
                        break;
                    case FeedTypes.COMPOSED:
                        if (!feedInstance._fields || feedInstance._fields.length === 0) {
                            let err = new Error(`Model "${Model.modelName}" can't be validated, invalid "fields" property (${feedInstance._fields}).`);
                            err.statusCode = err.status = 422;
                            err.name = 'Validation Error';
                            return Promise.reject(err);
                        }
                        fieldDescriptions = feedInstance._fields;
                        break;
                }
                let fieldDescriptionsByName = {};
                let properties = {date: {type: 'Date', required: true}};
                for (let field of fieldDescriptions) {
                    properties[field.name] = {
                        type: 'object',
                        required: field.required
                    };
                    fieldDescriptionsByName[field.name] = {
                        type: field.type,
                        required: field.required
                    };
                }
                let options = {
                    strict: true
                };

                let FeedData = loopback.PersistedModel.extend(self.feedDataCollectionName(Model, feedInstance.getId()), properties, options);
                FeedData.observe('before save', function (ctx, next) {
                    if (ctx.isNewInstance && ctx.instance) {
                        let properties = ctx.instance.toJSON();
                        for (let prop in properties) {
                            if (prop != 'date' && properties[prop]) {
                                let fieldDesc = fieldDescriptionsByName[prop];
                                if (fieldDesc) {
                                    let ret = FieldTypes.isValid(fieldDesc.type, ctx.instance[prop]);
                                    if (ret.err) return next(ret.err);
                                    if (!ret.valid) {
                                        let err = new Error(`Invalid data. Wrong type for "${prop}" field. "${fieldDesc.type}" expected.`);
                                        err.statusCode = err.status = 422;
                                        return next(err);
                                    }
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
