'use strict';

var fs = require('fs');
var path = require('path');
var through = require('through2');

var readCustom = () => {
    let jsons = [
        { key: 'definitions', file: 'definitions.json' },
        { key: 'tags', file: 'tags.json' }
    ];
    return Promise.all(jsons.map((json) => {
        return new Promise((resolve, reject) => {
            fs.readFile(path.join(__dirname, json.file), (err, data) => {
                if (err) return reject(err);
                resolve(JSON.parse(data));
            });
        })
        .then((data) => {
            json.content = data;
            return json;
        });
    }))
    .then((fields) => {
        return new Promise((resolve, reject) => {
            fs.readdir(path.join(__dirname, 'paths'), (err, files) => {
                if (err) return reject(err);
                resolve(files);
            });
        })
        .then((pathsFiles) => {
            return Promise.all(pathsFiles.map((pathFile) => {
                return new Promise((resolve, reject) => {
                    fs.readFile(path.join(__dirname, 'paths', pathFile), (err, data) => {
                        if (err) return reject(err);
                        resolve(JSON.parse(data));
                    });
                });
            }))
        })
        .then((pathsObjs) => {
            fields.push({ key: 'paths', content: Object.assign({}, ...pathsObjs) });
            return fields;
        });
    })
    .then((fields) => {
        let ret = {};
        for (let field of fields) {
            ret[field.key] = field.content;
        }
        return ret;
    });
};

var mergeDoc = () => {
    return through.obj(function (file, enc, cb) {
        readCustom()
        .then((jsons) => {
            let base = JSON.parse(file.contents.toString());
            base.definitions = jsons.definitions;
            base.tags = jsons.tags;
            base.paths = jsons.paths;
            file.contents = Buffer.from(JSON.stringify(base));
            this.push(file);
        }, (err) => {
            this.emit('error', err);
        })
        .then(() => cb());
    });
};

module.exports = mergeDoc;