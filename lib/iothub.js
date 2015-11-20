/*!
 * Module dependencies.
 */
var loopback = require('loopback');

var iothub = module.exports = createIotHub;

iothub.version = require('../package.json').version;

function createIotHub(options) {
    var app = loopback();

    

    return app;
}
