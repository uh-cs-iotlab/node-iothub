module.exports = function(ComposedFeed) {

    ComposedFeed.validatesLengthOf('_fields', {min: 1, message: {min: 'At least one field is required'}});

};
