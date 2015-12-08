var vm = require('vm'),
request = require('request'),
asyncEval = require('async-eval');

var iothubvm = module.exports = createIotHubvm;
iothubvm.version = require('../package.json').version;

function createIotHubvm(options) {
    var thevm = {
        options: options,
        runScript: runScript

    };
    return thevm;
}

function sandbox(options) {
    options = options || {}

    var sandbox = {
        this: {},
        context: {},
        asyncFunctions: {}
    };

    // Need to define the print command
    sandbox.context.print = function(msg) {
        console.log(msg);
    }

    if (options.XMLHttpRequest) {
        //sandbox.context.XMLHttpRequest = XMLHttpRequest;
        sandbox.asyncFunctions.XMLHttpRequest = XMLHttpRequest;
    }

    return sandbox;
}

function runScript(script, callback) {
    var sb = sandbox(this.options);
    var code = "function wrapper() {" + script +
        "}; this.result = wrapper();"
    callback = callback || function(res){};
    asyncEval(code, sb, function(err) {
        //console.log(sb,this);
        callback(err, sb.this.result);
    });
}

function XMLHttpRequest() {
    var xhr = {
        UNSENT: 0,
        OPENED: 1,
        HEADERS_RECEIVED: 2,
        LOADING: 3,
        DONE: 4,
        readyState: this.UNSENT,
        onreadystatechange: null,
        onerror: function(error) {
            console.error(error);
        },
        open: function(method, address, async, username, password) {
            //First things first, abort
            this.abort();
            this.settings = {
                method: method,
                address: address,
                async: async,
                username: username,
                password: password
            };
        },
        send: function(payload) {
            var options = {
                method: this.settings.method,
                uri: this.settings.address,
                json: payload
            };
            var onerror = this.onerror,
            onreadystatechange = this.onreadystatechange;
            request(options, function(error, response, body) {
                if (error) {
                    onerror(error);
                }
                else if (response.statusCode !== 200 && response.statusCode !== 0) {
                    onerror('The status code is unvalid: ' + response.statusCode);
                }
                else {
                    onreadystatechange(body); 
                }
            });
        },
        close: function() {
            this.abort();
            this.readyState = UNSENT;
            this.settings = null;
        },
        abort: function() {

        }
    };
    return xhr;
}

function TCPSocket() {
    var tcpSocket = {};
    var socket = new net.Socket();
    tcpSocket.connect = function(address, port) {
	   socket.connect(address, port, function() {
	       console.log('Connected');
	   });
    };

    socket.on('data', function(data) {
	   console.log('Client received: ' + data);
	   tcpSocket.onreceive(data);
    });

    socket.on('close', function() {
	   console.log('Connection closed');
    });

    tcpSocket.close = function() {
	   socket.destroy();
    }
}
