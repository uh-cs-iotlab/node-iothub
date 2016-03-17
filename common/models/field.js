'use strict';

var FieldTypes = require('../../server/field-types');

module.exports = function (Field) {

    Field.validate('type', function (err) {
        var schema = FieldTypes.get(this.type);
        if (schema == null) err();
    }, {message: 'Unknown type'});

};
