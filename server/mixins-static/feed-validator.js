'use strict';

var loopback = require('loopback');
var FeedData = require('../feed-data');
var FeedTypes = require('../feed-types.json');
var FieldTypes = require('../field-types');

module.exports = function (Model, mixinOptions) {

    Model.defineProperty('validated', {type: 'boolean', default: false});
    if (Model.settings.hidden) Model.settings.hidden.push('validated');
    else Model.settings.hidden = ['validated'];
    if (Model.settings.acls) {
        Model.settings.acls.push({
            accessType: 'READ',
            property: ['getData', 'getDataFormat', 'createDataChangeStream'],
            principalType: 'ROLE',
            principalId: '$authenticated',
            permission: 'ALLOW'
        }, {
            accessType: 'WRITE',
            property: 'postData',
            principalType: 'ROLE',
            principalId: '$authenticated',
            permission: 'ALLOW'
        });
    }

    var fieldPropertyName = function () {
        switch (mixinOptions.type) {
            case FeedTypes.ATOMIC:
                return '_field';
            case FeedTypes.COMPOSED:
                return '_fields';
        }
    };

    Model.getDataFormat = function (modelId, cb) {
        var reqP = Model.filteredFindById(modelId)
        .then((model) => {
            var fields = [].concat(model[fieldPropertyName()]);
            var format = {};
            return Promise.all(fields.map((field) => {
                return FieldTypes.dataFormat(field.type)
                .then((schema) => {
                    format[field.name] = {
                        format: schema,
                        required: field.required
                    };
                });
            }))
            .then(() => format);
        });
        if (cb) return reqP.then((format) => cb(null, format), (err) => cb(err));
        return reqP;
    };
    Model.remoteMethod(
        'getDataFormat',
        {
            description: 'Get accepted data format for this feed',
            accessType: 'READ',
            accepts: {arg: 'id', type: 'string', required: true},
            returns: {arg: 'format', type: 'object', root: true},
            http: {verb: 'get', path: '/:id/data-format'}
        }
    );

    Model.getData = function (modelId, filter, cb) {
        var reqP = Model.filteredFindById(modelId)
        .then((model) => FeedData.get(Model, {modelId, filter}));
        if (cb) return reqP.then((data) => cb(null, data), (err) => cb(err));
        return reqP;
    };
    Model.remoteMethod(
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

    Model.createDataChangeStream = function (modelId, cb) {
        var reqP = Model.filteredExists(modelId)
        .then((exists) => {
            if (!exists) return null;
            return FeedData.getChangeStream(Model, {modelId});
        });
        if (cb) reqP.then((changes) => cb(null, changes), (err) => cb(err));
        return reqP;
    };
    Model.remoteMethod(
        'createDataChangeStream',
        {
            description: 'Create a data change stream.',
            accessType: 'READ',
            accepts: {arg: 'id', type: 'any', description: 'Model id', required: true, http: {source: 'path'}},
            http: {verb: 'get', path: '/:id/data-stream'},
            returns: {arg: 'changes', type: 'ReadableStream', json: true},
            rest: {after: Model.convertNullToNotFoundError}
        }
    );

    Model.postData = function (modelId, data, cb) {
        var reqP = Model.filteredFindById(modelId)
        .then((model) => FeedData.insert(Model, data, {modelId}));
        if (cb) return reqP.then((createdData) => cb(null, createdData), (err) => cb(err));
        return reqP;
    };
    Model.remoteMethod(
        'postData',
        {
            description: 'Post feed data',
            accessType: 'WRITE',
            accepts: [
                {arg: 'id', type: 'string', required: true},
                {arg: 'data', type: 'object', http: {source: 'body'}}
            ],
            returns: {arg: 'created-data', type: 'object', root: true},
            http: {verb: 'post', path: '/:id/data'}
        }
    );

    Model.isValidated = function (modelId, cb) {
        var reqP = Model.findById(modelId)
        .then((model) => {
            return model.validated;
        });
        if (cb) return reqP.then((validated) => cb(null, validated), (err) => cb(err));
        return reqP;
    };
    Model.remoteMethod(
        'isValidated',
        {
            description: 'Check if the feed has already been validated',
            accepts: {arg: 'id', type: 'string', required: true},
            returns: {arg: 'validated', type: 'boolean'},
            http: {verb: 'get', path: '/:id/validated'}
        }
    );

    var validateFeedFields = function (model) {
        if (mixinOptions.type !== FeedTypes.COMPOSED) return true;
        var duplicates = {};
        for (var field of model[fieldPropertyName()]) {
            var duplInfo = duplicates[field.name];
            if (typeof duplInfo === 'undefined') {
                duplicates[field.name] = [field.getId()];
            } else {
                duplicates[field.name].push(field.getId());
            }
        }
        var duplicatesLen = 0;
        for (var dupl in duplicates) {
            duplicatesLen++;
            if (duplicates[dupl].length === 1) {
                delete duplicates[dupl];
                duplicatesLen--;
            }
        }
        if (duplicatesLen === 0) {
            return true;
        } else {
            return duplicates;
        }
    };

    Model.validate = function (modelId, cb) {
        var validatedChanged = false;
        var reqP = Model.findById(modelId)
        .then((model) => {
            if (!model.validated) {
                var feedFieldsValid = validateFeedFields(model);
                if (typeof feedFieldsValid === 'object') {
                    var duplErr = new Error(`Duplicate field names: ${JSON.stringify(feedFieldsValid)}`);
                    duplErr.statusCode = duplErr.status = 422;
                    return Promise.reject(duplErr);
                }
                var dataCollectionName = FeedData.feedDataCollectionName(Model, model.getId());
                if (Model.registry.findModel(dataCollectionName)) {
                    var existsErr = new Error(`A data collection already exists for this model instance: ${dataCollectionName}`);
                    existsErr.statusCode = existsErr.status = 422;
                    return Promise.reject(existsErr);
                }
                return FeedData.create(Model, model, mixinOptions)
                .then((FeedData) => {
                    return model.updateAttribute('validated', true)
                    .then(() => {
                        validatedChanged = true;
                        return FeedData;
                    });
                });
            }
        });
        if (cb) return reqP.then(FeedData => cb(null, {changed: validatedChanged}), err => cb(err));
        return reqP;
    };
    Model.remoteMethod(
        'validate',
        {
            description: 'Validate feed for use and create data collection',
            accepts: {arg: 'id', type: 'string', required: true},
            returns: {type: 'object', root: true},
            http: {verb: 'post', path: '/:id/validate'}
        }
    );

    Model.forceDeleteById = function (modelId, cb) {
        loopback.getCurrentContext().set('forceDelete', true);
        var reqP = Model.destroyById(modelId);
        if (cb) reqP.then((data) => cb(null, data), (err) => cb(err));
        return reqP;
    };
    Model.remoteMethod(
        'forceDeleteById',
        {
            description: 'Force-delete a model instance by id from the data source.',
            accessType: 'WRITE',
            accepts: {arg: 'id', type: 'any', description: 'Model id', required: true, http: {source: 'path'}},
            http: {verb: 'del', path: '/:id/force'},
            returns: {arg: 'count', type: 'object', root: true}
        }
    );

    Model.observe('before save', function (ctx, next) {
        var hookP = Promise.resolve();
        // By default, a new instance is not validated
        if (ctx.isNewInstance === true) {
            ctx.instance.validated = false;
        } else {
            // If the model is modified and is validated, we have to forbid field modification
            // It's a way to keep consistency with data collection
            if (ctx.currentInstance && ctx.currentInstance.validated) {
                // CASE 1:
                // This is executed when the action is updateAttributes()
                // That means what we can simply remove modifications that are related to fields
                delete ctx.data[fieldPropertyName()];
            } else if (ctx.instance && ctx.instance.validated) {
                // CASE 2:
                // This is executed in all cases where one instance is modified
                // We have to check if fields have been modified, so we check currently persisted instance
                // If the fields are modified, reject the modification
                hookP = Model.findById(ctx.instance.getId())
                .then((oldInstance) => {
                    var oldFields = oldInstance[fieldPropertyName()];
                    var newFields = ctx.instance[fieldPropertyName()];
                    if (oldFields.toJSON() !== newFields.toJSON()) {
                        var err = new Error(`Fields property can't be modified on validated "${Model.modelName}" id "${ctx.instance.getId()}".`);
                        err.statusCode = err.status = 401;
                        return Promise.reject(err);
                    }
                });
            } else if (!ctx.instance) {
                // CASE 3:
                // This is executed when the action is updataOrCreate() or updateAll()
                // As in CASE 1, we could remove modifications that involve fields
                // But in this case, the user will assume that the modification has been made for all feeds, which is wrong
                // So it's simpler to return an error
                if (ctx.where.hasOwnProperty(fieldPropertyName())) {
                    hookP = Model.findOne({where: {validated: true}})
                    .then((validatedInstance) => {
                        if (validatedInstance) {
                            var err = new Error(`Update has failed. One or more instances of "${Model.modelName}" are validated.`);
                            err.statusCode = err.status = 401;
                            return Promise.reject(err);
                        }
                    });
                }
            }
        }
        hookP.then(() => next(), (err) => next(err));
    });

    Model.observe('before delete', function (ctx, next) {

        var validatedErr = function (modelName, modelId) {
            var err = new Error(`"${modelName}" id "${modelId}" is validated. Use force-delete instead.`);
            err.statusCode = err.status = 422;
            return err;
        };

        var getModelsP;
        if (ctx.instance) {
            getModelsP = Promise.resolve([ctx.instance]);
        } else {
            getModelsP = Model.find({where: ctx.where})
            .then(models => models);
        }
        var hookP = getModelsP.then((models) => {
            if (models.length === 1) {
                var model = models[0];
                if (model.validated) {
                    var currCtx = loopback.getCurrentContext();
                    var forced = currCtx.get('forceDelete');
                    if (forced) {
                        currCtx.set('forceDelete', false);
                        var collectionName = FeedData.feedDataCollectionName(Model, model.getId());
                        if (Model.registry.findModel(collectionName)) {
                            ctx.hookState.dataCollectionName = collectionName;
                        } else {
                            var dcNotFoundErr = new Error(`Data collection "${collectionName}" not found for feed "${Model.modelName}" id "${model.getId()}".`);
                            dcNotFoundErr.statusCode = dcNotFoundErr.status = 422;
                            return Promise.reject(dcNotFoundErr);
                        }
                    } else {
                        return Promise.reject(validatedErr(Model.modelName, model.getId()));
                    }
                }
            } else {
                return Promise.all(models.map((model) => {
                    if (model.validated) {
                        return Promise.reject(validatedErr(Model.modelName, model.getId()));
                    } else {
                        return Promise.resolve();
                    }
                }));
            }
            return Promise.resolve();
        });
        hookP.then(() => next(), (err) => next(err));
    });

    Model.observe('after delete', function (ctx, next) {
        var hookP = Promise.resolve();
        if ('dataCollectionName' in ctx.hookState) {
            var dataColName = ctx.hookState.dataCollectionName;
            var DataCollection = Model.registry.findModel(dataColName);
            if (DataCollection) {
                // TODO: find how to remove the model
                hookP = DataCollection.destroyAll();
            } else {
                var dcNotFoundErr = new Error(`Data collection "${dataColName}" not found for feed "${Model.modelName}" id "${ctx.instance.getId()}".`);
                dcNotFoundErr.statusCode = dcNotFoundErr.status = 422;
                hookP = Promise.reject(dcNotFoundErr);
            }
        }
        hookP.then(() => next(), (err) => next(err));
    });

};
