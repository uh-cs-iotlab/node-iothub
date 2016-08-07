'use strict';

var vm = require('duktape'),

var duktapevm = module.exports = duktapeVM;

function duktapeVM(options) {
    var thevm = {
        options: options,
        runScript: runScript
    };
    return thevm;
}

function requireFromString(src, filename) {
    var m = new module.constructor();
    m.paths = module.paths;
    m._compile(src, filename);
    return m.exports;
}

function sandbox(options) {
    
    options = options || {}

    var sandbox = {};

    // Need to define the print command
    sandbox.print = function(msg) {
        console.log(msg);
    }

    sandbox.data = options.data || undefined;

    // Define lib property for sandbox to enable adding library functions
    // for scripts
    sandbox.lib = {}
    try {
        Object.keys(options.lib).forEach(function(key) {
            sandbox.lib[key] = requireFromString(options.lib[key].source);
        });
    } catch (err) {
        return null;
    }

    return sandbox;
}

function runScript(origScript, callback) {
    var apiObject = sandbox(this.options);
    var script = "function wrapper(param) { " + origScript + "};";

    try {
        result = vm.run('wrapper', '', script, apiObject, callback);
    } catch(err) {
        callback(err, result);
    }
}

