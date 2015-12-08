var vm = require('vm'),
request = require('request'),
EventEmitter = require('events').EventEmitter;

var iothubvm = module.exports = createIotHubvm;
iothubvm.version = require('../package.json').version;

function createIotHubvm(options) {
    var thevm = {
        options: options,
        runScript: runScript
    };
    return thevm;
}

function sandbox(events, options) {
    
    options = options || {}

    var sandbox = {};

    // Need to define the print command
    sandbox.print = function(msg) {
        console.log(msg);
    }

    if (options.XMLHttpRequest) {
        sandbox.XMLHttpRequest = function() {
            return XMLHttpRequest(events);
        };
    }

    return sandbox;
}

//Callback is on the form function(err, result)
function runScript(script, callback) {
    // Create a new event emitter for the async functions we will be running
    // This bits of code is inspired by https://github.com/dallonf/async-eval
    var events = new EventEmitter();
    var sb = sandbox(events, this.options);

    events.on('addCallback', function() {
        callbackCount++;
    });

    var result, error, callbackCount = 0;
    events.on('removeCallback', function() {
        callbackCount--;
        if (callbackCount <= 0) {
            callback(error, result);
        }
    });

    try {
        result = vm.runInNewContext(script, sb);
        if (callbackCount <= 0) {
            callback(error, result);
        }
    } catch(err) {
        callback(err, result);
    }
}

function XMLHttpRequest(events) {
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
            this.readyState = this.OPENED;
        },
        
        send: function(payload) {
            events.emit('addCallback');
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
                events.emit('removeCallback');
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
