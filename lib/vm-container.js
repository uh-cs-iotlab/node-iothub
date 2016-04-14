'use strict';

// This container is used to allow for defining new virtual machines in which the scripts
// are executed. Adding a file to lib folder with the convention <vmName>-vm.js enables usage of
// that vm for scripts.
module.exports = {

	getVM: function (name, options) {
		try {
			var newVM = require('../lib/'+ name + '-vm');
	    	return newVM(options);

		} catch(err) {
			console.log(err);
		}
	}
};
