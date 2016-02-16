var FieldTypes = {
    TEMPERATURE: 'temperature'
};

Object.defineProperty(FieldTypes, 'loopback', {
    enumerable: false,
    value: (type) => {
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
    }
});
Object.defineProperty(FieldTypes, 'isValid', {
    enumerable: false,
    value: (type, value) => {
        if (LoopbackTypes[type] !== 'object' || typeof value !== 'object') return false;
        var validator = TypeValidator[type];
        if (!validator) return false;
        var valueKeys;
        // Workaround because sometimes loopback sets the value as a Model
        if ('__data' in value) {
            valueKeys = Object.keys(value.__data);
        } else {
            valueKeys = Object.keys(value);
        }
        var validatorKeys = Object.keys(validator);
        if (valueKeys.length !== validatorKeys.length) return false;
        for (var key of validatorKeys) {
            if (!value[key] || typeof value[key] !== validator[key]) return false;
        }
        return true;
    }
});
Object.defineProperty(FieldTypes, 'dataFormat', {
    enumerable: false,
    value: type => TypeValidator[type] || this.loopback(type)
});

var LoopbackTypes = {
    [FieldTypes.TEMPERATURE]: 'object'
};

var TypeValidator = {
    [FieldTypes.TEMPERATURE]: {unit: 'string', val: 'number'}
};

module.exports = FieldTypes;
