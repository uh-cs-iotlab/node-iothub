'use strict';

var SwaggerUi = require('swagger-ui-browserify');

var swaggerUi = new SwaggerUi({
    url: '/doc/swagger.json',
    dom_id: "docContainer",
    supportedSubmitMethods: []
});
swaggerUi.load();