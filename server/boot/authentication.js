'use strict';

module.exports = function enableAuthentication(server) {
    // enable authentication
  	if (server.get('enableAuth')) {
    	server.enableAuth();
  	}
};
