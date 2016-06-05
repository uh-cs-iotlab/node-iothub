'use strict';

var SchemasManager = module.exports = class {
    constructor() {
        /*
         This object is a tree that contains schemas of field types.
         Each inner node is an object representing a level (e.g. 'root' which is not the root of the tree).
         Each leaf is the content of the schema file.
         */
        this.db = {};
    }

    get(id) {
        if (!id) return null;
        return this._getSchema(this._formatId(id), this.db);
    }

    set(schema) {
        if (!schema.id) return new Error('No id property');
        return this._setSchemaHelper(this._formatId(schema.id), this.db, schema);
    };

    _formatId(id) {
        if (id.charAt(0) === '/') id = id.substr(1);
        return id.split('/');
    }

    _getSchema(levels, subtree) {
        let currLevel = levels.shift();
        if (subtree.hasOwnProperty(currLevel)) {
            if (levels.length === 0) {
                // this is the end
                return subtree[currLevel];
            } else {
                return this._getSchema(levels, subtree[currLevel]);
            }
        } else {
            return null;
        }
    }

    _setSchemaHelper(levels, subtree, schema) {
        let currLevel = levels.shift();
        if (levels.length === 0) {
            // this is the end
            if (subtree.hasOwnProperty(currLevel)) {
                return new Error('Schema already exists');
            } else {
                subtree[currLevel] = schema;
                return null;
            }
        } else {
            let nodeCreated = false;
            if (!subtree.hasOwnProperty(currLevel)) {
                subtree[currLevel] = {};
                nodeCreated = true;
            }
            let err = this._setSchemaHelper(levels, subtree[currLevel], schema);
            if (err && nodeCreated) delete subtree[currLevel];
            return err;
        }
    }

};