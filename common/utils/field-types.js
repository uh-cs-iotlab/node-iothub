'use strict';

var fs = require('fs');
var path = require('path');
var Validator = require('jsonschema').Validator;
var $RefParser = require('json-schema-ref-parser');
var SchemasManager = require('./schemas-manager');
var schemaManager = new SchemasManager;

/*
    These short types can be used as aliases for field types.
    Note that if the user creates another type with a short type as id,
    this creates a conflict and neither user type and short type can't be used.
 */
var shortTypes = {
    boolean: '/root/boolean',
    genericSensor: '/root/genericSensor',
    integer: '/root/integer',
    number: '/root/number',
    string: '/root/string',
    temperature: '/root/temperature'
};

var schemasDir = path.join(__dirname, '..', 'data-types');
var loadSchemas = (schemaPath) => {
    let files = fs.readdirSync(schemaPath);
    return Promise.all(files.map((filename) => {
        let filePath = path.join(schemaPath, filename);
        let stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            return loadSchemas(filePath);
        } else {
            let returnObj = {filePath};
            if (filename.endsWith('.json')) {
                let schema = null;
                try {
                    schema = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                } catch (err) {
                    err.message = `Error parsing file "${filePath}": ${err.message}`;
                    return Promise.reject(err);
                }
                let err = schemaManager.set(schema);
                if (err) returnObj.err = err;
            }
            return Promise.resolve(returnObj);
        }
    }));
};
loadSchemas(schemasDir)
.then((files) => {
    files.forEach((file) => {
        if (file.err) {
            console.warn(`Schema file "${file.filePath}" has been ignored: ${err.toString()}`);
        }
    });
}, (err) => {
    console.error(err.toString());
    process.exit(1);
});

var importNextSchema = (validator) => {
    let nextSchemaId = validator.unresolvedRefs.shift();
    if (nextSchemaId) {
        return FieldTypes.get(nextSchemaId)
        .then((schema) => {
            if (schema != null) {
                validator.addSchema(schema);
                return importNextSchema(validator);
            }
        });
    }
    return Promise.resolve();
};

var refResolver = {
    order: 1,
    canRead: true,
    read(ref) {
        return FieldTypes.get(ref.url);
    }
};

var schemaExists = (schema) => {
    return typeof schema === 'object' && schema != null;
};

var AmbiguousTypeError = function (message) {
    Error.call(this, message);
    this.name = 'AmbiguousTypeError';
};
AmbiguousTypeError.prototype = Object.create(Error.prototype);
AmbiguousTypeError.prototype.constructor = AmbiguousTypeError;

var FieldTypes = module.exports = {
    AmbiguousTypeError,
    exists(id) {
        return this.get(id)
        .then(schemaExists);
    },
    // @throws AmbiguousTypeError
    existsSync(id) {
        return schemaExists(this.getSync(id));
    },
    get(id) {
        try {
            let schema = this.getSync(id);
            return Promise.resolve(schema);
        } catch (err) {
            return Promise.reject(err);
        }
    },
    // @throws AmbiguousTypeError
    getSync(id) {
        let schema = schemaManager.get(id);
        if (shortTypes.hasOwnProperty(id)) {
            if (schema) {
                let err = new AmbiguousTypeError(`Ambiguous type: "${id}"`);
                err.fieldType = id;
                err.statusCode = err.status = 422;
                throw err;
            } else {
                id = shortTypes[id];
                return schemaManager.get(id);
            }
        }
        return schema;
    },
    isValid(id, value) {
        return this.get(id)
        .then((schema) => {
            if (schema == null) return false;
            let v = new Validator();
            v.addSchema(schema);
            return importNextSchema(v)
            .then(() => {
                let result = v.validate(value.valueOf(), schema);
                return result.valid;
            });
        });
    },
    dataFormat(id) {
        return this.get(id)
        .then((schema) => {
            if (schema == null) return null;
            let parser = new $RefParser();
            return parser.bundle(schema, {resolve: {fieldTypes: refResolver}});
        });
    }
};
