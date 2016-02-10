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
            }).then((app) => {
                var fieldDescriptions;
                switch(createOptions.type) {
                    case FeedTypes.ATOMIC:
                        if (!feedInstance._field) {
                            var err = new Error(`Model "${Model.modelName}" can't be validated, invalid "field" property (${feedInstance._field})`);
                            err.statusCode = err.status = 422;
                            err.name = 'Validation Error';
                            return Promise.reject(err);
                        }
                        fieldDescriptions = [feedInstance._field];
                        break;
                    case FeedTypes.COMPOSED:
                        if (!feedInstance._fields || feedInstance._fields.length === 0) {
                            var err = new Error(`Model "${Model.modelName}" can't be validated, invalid "fields" property (${feedInstance._fields})`);
                            err.statusCode = err.status = 422;
                            err.name = 'Validation Error';
                            return Promise.reject(err);
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
                FeedData = app.model(FeedData, {dataSource: 'db', public: false});
                return Promise.resolve(FeedData);
            });
        }
    }

};
