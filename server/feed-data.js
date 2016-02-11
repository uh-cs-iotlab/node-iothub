var loopback = require('loopback');
var FeedTypes = require('./feed-types.json');
var FieldTypes = require('./field-types');

module.exports = {

    create(Model, feedInstance, createOptions) {
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
                switch(createOptions.type) {
                    case FeedTypes.ATOMIC:
                        if (!feedInstance._field) {
                            var atomicErr = new Error(`Model "${Model.modelName}" can't be validated, invalid "field" property (${feedInstance._field})`);
                            atomicErr.statusCode = atomicErr.status = 422;
                            atomicErr.name = 'Validation Error';
                            return Promise.reject(atomicErr);
                        }
                        fieldDescriptions = [feedInstance._field];
                        break;
                    case FeedTypes.COMPOSED:
                        if (!feedInstance._fields || feedInstance._fields.length === 0) {
                            var composedErr = new Error(`Model "${Model.modelName}" can't be validated, invalid "fields" property (${feedInstance._fields})`);
                            composedErr.statusCode = composedErr.status = 422;
                            composedErr.name = 'Validation Error';
                            return Promise.reject(composedErr);
                        }
                        fieldDescriptions = feedInstance._fields;
                        break;
                }
                var properties = {date: {type: 'Date', required: true}};
                for (var field of fieldDescriptions) {
                    properties[field.name] = {
                        type: FieldTypes.loopback(field.type),
                        required: field.required
                    };
                }
                var options = {
                    strict: true,
                };

                var FeedData = loopback.PersistedModel.extend(createOptions.feedDataCollection, properties, options);
                return app.model(FeedData, {dataSource: 'db', public: false});
            });
        }
    }

};
