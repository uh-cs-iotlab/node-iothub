'use strict';

var FieldTypes = require('../utils/field-types');

module.exports = function (Field) {

    // TODO: convert to validateAsync once it will work (https://github.com/strongloop/loopback-datasource-juggler/pull/900)
    Field.validate('type', function (errCb) {
        try {
            let exists = FieldTypes.existsSync(this.type);
            if (!exists) errCb('unknown');
        } catch (err) {
            if (err instanceof FieldTypes.AmbiguousTypeError) return errCb('ambiguous');
            throw err;
        }
    }, {
        message: {
            unknown: 'Unknown type',
            ambiguous: 'Ambiguous type'
        }
    });

};
