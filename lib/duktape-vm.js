var vm = require('duktape'),

var duktapevm = module.exports = duktapeVM;

function duktapeVM(options) {
    var thevm = {
        options: options,
        runScript: runScript
    };
    return thevm;
}

function sandbox(options) {
    
    options = options || {}

    var sandbox = {};

    // Need to define the print command
    sandbox.print = function(msg) {
        console.log(msg);
    }

    sandbox.data = options.data || undefined;

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

