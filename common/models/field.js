var FieldTypes = require('../../server/field-types');

module.exports = function(Field) {

    var typeValues = [];
    for (var type in FieldTypes) {
        typeValues.push(FieldTypes[type]);
    }
    Field.validatesInclusionOf('type', {in: typeValues});

};
