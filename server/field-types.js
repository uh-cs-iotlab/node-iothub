var FieldTypes = {
    TEMPERATURE: 'temperature',

    loopback(type) {
        return LoopbackTypes[type];
    },
    isValid(type, value) {
        if (LoopbackTypes[type] !== 'object' || typeof value !== 'object') return false;
        var validator = TypeValidator[type];
        if (!validator) return false;
        var valueKeys = Object.keys(value);
        var validatorKeys = Object.keys(validator);
        if (valueKeys.length !== validatorKeys.length) return false;
        for (var key of validatorKeys) {
            if (!value[key] || typeof value[key] !== validator[key]) return false;
        }
        return true;
    },
    dataFormat(type) {
        return TypeValidator[type] || this.loopback(type);
    }
};

var LoopbackTypes = {
    [FieldTypes.TEMPERATURE]: 'object'
};

var TypeValidator = {
    [FieldTypes.TEMPERATURE]: {unit: 'string', val: 'number'}
};

module.exports = FieldTypes;
