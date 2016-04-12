'use strict';

var FieldTypes = require('../utils/field-types');

module.exports = function (Field) {

    // TODO: convert to validateAsync once it will work (https://github.com/strongloop/loopback-datasource-juggler/pull/900)
    Field.validate('type', function (errCb) {
        let ret = FieldTypes.exists(this.type);
        if (ret.err) return errCb('ambiguous');
        if (!ret.exists) errCb('unknown');
    }, {
        message: {
            unknown: 'Unknown type',
            ambiguous: 'Ambiguous type'
        }
    });

};
