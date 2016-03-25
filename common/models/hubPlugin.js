'use strict';

var iothubvm = require('../../lib/iothub-vm');

function validatePluginScript(err) {
	var script = this.script;
	var name = this.name;
	var buffer64 = new Buffer(script, 'base64');
	var vm = iothubvm();
	if(!vm.checkPlugin(name, buffer64.toString('utf8'))) {
		err();
	}
};

module.exports = function(plugin) {
	plugin.validatesPresenceOf('name', 'type', 'script', 'isService')
  	plugin.validatesLengthOf('name', { min: 1, message: {min: 'Name is too short' }});
  	// 'native' plugins in our case are also JS plugins but nodejs that can be used with require('nameoftheplugin')
  	// 'iothub' plugins are pure JS code which should work across all IoT Hub implementation
  	plugin.validatesInclusionOf('type', { in: ['native', 'iothub'], message: "type should be either native or iothub" });
  	plugin.validatesUniquenessOf('name', { message: 'name is not unique' });
  	// I would like to give more information about why the plugin is not valid
  	plugin.validate('script', validatePluginScript, { message: 'The plugin is not valid' });
}