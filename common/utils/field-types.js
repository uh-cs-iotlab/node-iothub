'use strict';

var fs = require('fs');
var path = require('path');
var Validator = require('jsonschema').Validator;
var $RefParser = require('json-schema-ref-parser');

var shortTypes = {
    boolean: '/root/boolean',
    genericSensor: '/root/genericSensor',
    integer: '/root/integer',
    number: '/root/number',
    string: '/root/string',
    temperature: '/root/temperature'
};

var schemasDb = {};
var _formatId = (id) => {
    if (id.charAt(0) === '/') id = id.substr(1);
    return id.split('/');
};
var _getSchema = (levels, subtree) => {
    var currLevel = levels.shift();
    if (subtree.hasOwnProperty(currLevel)) {
        if (levels.length === 0) {
            // this is the end
            return subtree[currLevel];
        } else {
            return _getSchema(levels, subtree[currLevel]);
        }
    } else {
        return null;
    }
};

var _setSchemaHelper = (levels, subtree, schema) => {
    var currLevel = levels.shift();
    if (levels.length === 0) {
        // this is the end
        if (subtree.hasOwnProperty(currLevel)) {
            return false;
        } else {
            subtree[currLevel] = schema;
            return true;
        }
    } else {
        if (!subtree.hasOwnProperty(currLevel)) subtree[currLevel] = {};
        return _setSchemaHelper(levels, subtree[currLevel], schema);
    }
};
var setSchema = (schema) => {
    return _setSchemaHelper(_formatId(schema.id), schemasDb, schema);
};

var schemasDir = path.join(__dirname, '..', 'data-types');
var _loadSchemas = (schemaPath) => {
    var files = fs.readdirSync(schemaPath);
    for (var filename of files) {
        var filePath = path.join(schemaPath, filename);
        var stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            _loadSchemas(filePath);
        } else {
            if (filename.endsWith('.json')) {
                try {
                    var schema = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    setSchema(schema);
                } catch (err) {}
            }
        }
    }
};
_loadSchemas(schemasDir);

var importNextSchema = (validator) => {
    let nextSchemaId = validator.unresolvedRefs.shift();
    if (nextSchemaId) {
        let ret = FieldTypes.get(nextSchemaId);
        if (ret.err) return {err: ret.err};
        if (ret.schema != null) {
            validator.addSchema(ret.schema);
            return importNextSchema(validator);
        }
    }
    return {};
};

var refResolver = {
    order: 1,
    canRead: true,
    read(ref) {
        let ret = FieldTypes.get(ref.url);
        if (ret.err) return Promise.reject(ret.err);
        return ret.schema;
    }
};

// TODO: convert to promise-based error handling once it's possible to use it in /common/models/field.js
var FieldTypes = module.exports = {
    exists(id) {
        let ret = this.get(id);
        if (ret.err) return {err: ret.err};
        return {exists: typeof ret.schema === 'object' && ret.schema != null};
    },
    get(id) {
        let schema = _getSchema(_formatId(id), schemasDb);
        if (shortTypes.hasOwnProperty(id)) {
            if (schema) {
                let err = new Error(`Ambiguous type: "${id}"`);
                err.fieldType = id;
                err.statusCode = err.status = 422;
                return {err};
            } else {
                id = shortTypes[id];
                return {schema: _getSchema(_formatId(id), schemasDb)};
            }
        }
        return {schema};
    },
    isValid(id, value) {
        let v = new Validator();
        let ret = this.get(id);
        if (ret.err) return {err: ret.err};
        let schema = ret.schema;
        if (schema == null) return {valid: false};
        v.addSchema(schema);
        ret = importNextSchema(v);
        if (ret.err) return {err: ret.err};
        let result = v.validate(value.valueOf(), schema);
        return {valid: result.valid};
    },
    // returns Promise
    dataFormat(id) {
        let ret = this.get(id);
        if (ret.err) return Promise.reject(ret.err);
        if (ret.schema == null) return null;
        let parser = new $RefParser();
        return parser.bundle(ret.schema, {resolve: {fieldTypes: refResolver}});
    }
};
