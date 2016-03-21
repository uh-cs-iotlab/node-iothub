'use strict';

var fs = require('fs');
var path = require('path');
var Validator = require('jsonschema').Validator;
var $RefParser = require('json-schema-ref-parser');

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

var schemasDir = path.join(__dirname, 'schemas');
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
    var nextSchemaId = validator.unresolvedRefs.shift();
    if (!nextSchemaId) return;
    var schema = FieldTypes.get(nextSchemaId);
    if (schema != null) {
        validator.addSchema(schema);
        importNextSchema(validator);
    }
};

var FieldTypes = module.exports = {
    exists(id) {
        return (this.get(id) !== null);
    },
    get(id) {
        return _getSchema(_formatId(id), schemasDb);
    },
    isValid(id, value) {
        var v = new Validator();
        var schema = this.get(id);
        if (schema != null) {
            v.addSchema(schema);
            importNextSchema(v);
            var result = v.validate(value, schema);
            return result.valid;
        }
        return false;
    },
    dataFormat(id) {
        var schema = this.get(id);
        if (schema == null) return null;
        var parser = new $RefParser();
        return parser.bundle(schema, {
            $refs: {
                read$RefFile: ($ref) => {
                    return Promise.resolve(JSON.stringify(_getSchema(_formatId($ref.path), schemasDb)));
                }
            }
        });
        return Promise.resolve({err: 'Not implemented yet.'});
    }
};
