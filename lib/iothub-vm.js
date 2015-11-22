var vm = require('vm');

var iothubVM = module.exports = createIotHubVM;
iothubVM.version = require('../package.json').version;

function createIotHubVM(options) {

    var sandbox = sandbox(options);
    var context = new vm.createContext(sandbox);

}

function sandbox(options) {
    // At the moment, we will accept everything that could be done
    // EventLoop (setTimeout, setInterval)
    // XMLHttpRequest and TcpSocket
    var sandbox = {};

    // add TCP Socket support
    sandbox.TCPSocket = TCPSocket;

    
    return sandbox;
}

iothubVM.runScript = function(script) {
    var Script = new vm.Script(script);
    script.runInContext(context);
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
