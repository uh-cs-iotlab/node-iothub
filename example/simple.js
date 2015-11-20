var iothub = require('../');

var server = iothub();

server.get('/', function (req, res) {
    res.send('Hello World!');
});

server.listen(3000, function () {
    console.log('Server listening')
});
