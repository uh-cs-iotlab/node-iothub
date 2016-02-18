var FieldTypes = {
    GENERIC_SENSOR: 'generic-sensor',
    ILLUMINANCE: 'illuminance',
    PRESENCE: 'presence',
    TEMPERATURE: 'temperature',
    HUMIDITY: 'humidity'
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
    [FieldTypes.GENERIC_SENSOR]: 'object',
    [FieldTypes.ILLUMINANCE]: 'object',
    [FieldTypes.PRESENCE]: 'boolean',
    [FieldTypes.TEMPERATURE]: 'object',
    [FieldTypes.HUMIDITY]: 'object'
};

var TypeValidator = {
    [FieldTypes.GENERIC_SENSOR]: {unit: 'string', val: 'number'},
    [FieldTypes.ILLUMINANCE]: {unit: 'string', val: 'number'},
    [FieldTypes.TEMPERATURE]: {unit: 'string', val: 'number'},
    [FieldTypes.HUMIDITY]: {unit: 'string', val: 'number'}
};

module.exports = FieldTypes;
