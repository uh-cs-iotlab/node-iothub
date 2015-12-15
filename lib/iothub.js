/*!
 * Module dependencies.
 */
var loopback = require('loopback'),
    assert = require('assert'),
    explorer = require('loopback-component-explorer');

var iothub = module.exports = createIotHub;

iothub.version = require('../package.json').version;

//Based on the same sequence than loopback-boot.executor
function createIotHub(config) {

    config = config || {name: 'iothub'};

    var app = loopback();
    app.booting = true;

    assertIothubVersion(app);

    setHost(app, config);
    setPort(app, config);
    setApiRoot(app, config);

    setupDataSources(app, config);
    setupModels(app, config);
    setupRoles(app);
    setupMiddlewares(app, config);
    setupComponents(app, config);    

    app.booting = false;
    finalize(app);
    
    app.booting = false;
    return app;
}

// So far it does nothing
function assertIothubVersion(app) {}

function setHost(app, config) {
    var host = process.env.npm_config_host || 
    process.env.OPENSHIFT_SLS_IP ||
    process.env.OPENSHIFT_NODEJS_IP ||
	process.env.VCAP_APP_HOST ||
	process.env.HOST ||
	config.host ||
	process.env.npm_package_config_host ||
	app.get('host');
    
    if (host !== undefined) {
	   assert(typeof host === 'string', 'app.host must be a string');
	   app.set('host', host);
    }
}

function find(array, predicate) {
  return array.filter(predicate)[0];
}

function setPort(app, config) {
    var port = find([
	process.env.npm_config_port,
	process.env.OPENSHIFT_SLS_PORT,
	process.env.OPENSHIFT_NODEJS_PORT,
	process.env.VCAP_APP_PORT,
	process.env.PORT,
	config.port,
	process.env.npm_package_config_port,
	app.get('port'),
	3000], function(p) {
	   return p != null;
    });
    
    if (port !== undefined) {
	   var portType = typeof port;
	   assert(portType === 'string' || portType === 'number',
	       'app.port must be a string or number');
	   app.set('port', port);
    }
}

function setApiRoot(app, config) {
    var restApiRoot =
	config.restApiRoot ||
	app.get('restApiRoot') ||
	'/api';
    
    assert(restApiRoot !== undefined, 'app.restBasePath is required');
    assert(typeof restApiRoot === 'string',
	   'app.restApiRoot must be a string');
    assert(/^\//.test(restApiRoot),
	   'app.restApiRoot must start with "/"');
    app.set('restApiRoot', restApiRoot);
}

function setupDataSources(app, config) {
    // We'll be using only two types data sources (one in the memory and one with mongodb)
    assert(typeof config.name === 'string' &&
	  config.name.length, 'config.name should be a non-empty string');

    var dataSources = config.dataSources || {
        "memory": {connector: "memory"},
        //Set the memory db as default
        "default": "memory"
    };
    
    //Add all the data sources present in the config file
    for (source in dataSources) {
        if (source === 'default') {
            assert(dataSources[source] in dataSources);
            app.dataSource(source, dataSources[dataSources[source]]);
        }
        else {
            app.dataSource(source, dataSources[source]);
        }
    }
}

function setupModels(app, config) {
    /* 
     * An Iot Hub API models includes plugins, enablers, 
     * feeds (atomic, composed and executable), services and applications
     * Each feed actually represents a submodel with the Iot Hub API data model specifications
     * We will also most of the loopback builtin models
     */
    var models = config.models || {};
    var registry = app.registry || app.loopback;

    // Built-in user model, access token, acl, role mapping, role
    var builtinModels = ["User", "Role", "RoleMapping", "AccessToken", "ACL"];
    for (var x in builtinModels) {
        var name = builtinModels[x];
        var model = registry.getModel(name);
        if (name in models) {
            app.model(model, models[name]);
        }
        else {
            app.model(model, { dataSource: "default", public: false });
        }
    }

    var feed = registry.createModel({
        "name": "feed",
        "base": "PersistedModel",
        "strict": true,
        "idInjection": true,
        "properties": {
            // Properties listed here depend on your responses to the CLI
             "name": { "type": "string", "required": true },
            "description": String,
            "atomic": Object,
            "composed": Object,
            "executable": Object,
            "keywords": [String]
        },
        "validations": [],
        "relations": {},
        "acls": [
            {
                "accessType": "*",
                "property": "*",
                "principalType": "ROLE",
                "principalId": "$everyone",
                "permission": "DENY"
            },
            {
                "accessType": "*",
                "property": "*",
                "principalType": "ROLE",
                "principalId": "admin",
                "permission": "ALLOW"
            }
        ],
        "methods": []
    });
    if ('feed' in models) {
        app.model(feed, models['feed']);
    } else {
        app.model(feed, { dataSource: "default", public: true });
    }

    //var oldAccess = Feed.checkAccess;
    /*Feed.checkAccess = function(token, modelId, sharedMethod, ctx, callback) {
        oldAccess(token, modelId, sharedMethod, ctx, callback);
    }*/

    /*var plugin = loopback.createModel(
    'plugin',
    {
        'name': {'type': 'string', 'required': true},
        'type': {'type': 'string', 'required': true},
    }
    );
    plugin.validatesInclusionOf('type', {in: ['NATIVE', 'JAVASCRIPT']});
    app.model(plugin, db);

    var enabler = loopback.createModel(
    'enabler',
    {
        'plugin': String 
    }
    );
    app.model(enabler, db);
    
    var feed = loopback.createModel(
    'feed',
    {
        'name': {'type': 'string', 'required': true},
        'description': String,
        'type': {'type': 'string', 'required': true},
        'atomic': Object,
        'composed': Object,
        'executable': Object,
        'keywords': [String]
    }
    );
    feed.validatesInclusionOf('type', {in: ['atomic', 'composed', 'executable']});
    app.model(feed, db);*/
}

function setupRoles(app) {
    var Role = app.models.Role;
    
    Role.create(
        {name: 'admin'}, // where
        function(err, role) {
            if (err) {  throw err; } 
        }
    );
}

function setupMiddlewares(app, config) {
    // We could also register the explorer as middleware
    // app.use('/explorer', explorer.routes(app, { basePath: app.get('restApiRoot')}));
}
    
function setupComponents(app, config) {
    // At the moment, we will add the explorer, but in the future we probably need a Iot Hub UI
    explorer(app, { basePath: app.get('restApiRoot'), mountPath: '/explorer'});
}

function finalize(app) {
    // Disable the legacy explorer
    app.set("legacyExplorer", false);

    // Create a LoopBack context for all requests
    app.use(loopback.context());

    // Expose the models over REST
    app.use(app.get("restApiRoot"), loopback.rest());

    app.enableAuth();
}
    