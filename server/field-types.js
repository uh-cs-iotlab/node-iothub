var FieldTypes = {
    TEMPERATURE: 'temperature',

    loopback(type) {
        return LoopbackTypes[type];
    }
};

var LoopbackTypes = {
    [FieldTypes.TEMPERATURE]: 'Number'
};

module.exports = FieldTypes;
