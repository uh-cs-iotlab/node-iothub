var loopback = require('loopback');
var FeedData = require('../feed-data');
var FeedTypes = require('../feed-types.json');

module.exports = function (Model, mixinOptions) {

    Model.defineProperty('validated', { type: 'boolean', default: false });
    if (Model.settings.hidden) Model.settings.hidden.push('validated');
    else Model.settings.hidden = ['validated'];

    var fieldPropertyName = function () {
        switch (mixinOptions.type) {
            case FeedTypes.ATOMIC:
                return '_field';
            case FeedTypes.COMPOSED:
                return '_fields';
        }
    };

    Model.isValidated = function (modelId, cb) {
        Model.findById(modelId)
        .then((model) => {
            return model.validated;
        })
        .then((validated) => {
            cb(null, validated);
        })
        .catch((err) => {
            cb(err);
        });
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
        Model.findById(modelId)
        .then((model) => {
            var feedDataCollection = `${Model.modelName}Data${model.getId()}`;
            if (!model.validated) {
                var feedFieldsValid = validateFeedFields(model);
                if (typeof feedFieldsValid === 'object') {
                    return Promise.reject(new Error(`Duplicate field names: ${JSON.stringify(feedFieldsValid)}`));
                }
                var createOptions = Object.assign({}, mixinOptions, {
                    feedDataCollection
                });
                return FeedData.create(Model, model, createOptions)
                .then((FeedData) => {
                    return model.updateAttribute('validated', true)
                    .then(() => {
                        validatedChanged = true;
                        return FeedData;
                    });
                });
            } else {
                return Model.registry.findModel(feedDataCollection);
            }
        })
        .then(FeedData => cb(null, {changed: validatedChanged}), err => cb(err));
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
                delete data[fieldPropertyName()];
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
                        return Promise.reject(new Error(`Fields property can't be modified on validated "${Model.modelName}" id "${ctx.instance.getId()}"`));
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
                            return Promise.reject(new Error(`Update has failed. One or more instances of "${Model.modelName}" are validated.`));
                        }
                    });
                }
            }
        }
        hookP.then(() => next(), (err => next(err)));
    });

};
