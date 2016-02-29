var expect = require('chai').expect,
    util = require('util'),
    express = require('express'),
    iothubvm = require('../../lib/iothub-vm');

function hook_consolelog(callback) {
    var old_log = console.log;

    console.log = (function (write) {
        return function () {
            callback.apply(null, arguments);
        }
    })(console.log);

    return function () {
        console.log = old_log;
    }
}

describe("IoT Hub javascript VM", function () {

    describe("Execute code without permission", function () {
        it("Hello world", function (done) {
            var script = "print('Hello World');";
            var output;
            var unhook = hook_consolelog(function (msg) {
                output = msg;
            });
            var vm = iothubvm();
            vm.runScript(script, function (err, res) {
                unhook();
                expect(res).to.be.undefined;
                expect(output).to.equal('Hello World');
                done();
            });
        });

        it("Hello world with return", function (done) {
            var script = "print('Hello World'); 5;";
            var output;
            var unhook = hook_consolelog(function (msg) {
                output = msg;
            });
            var vm = iothubvm();
            vm.runScript(script, function (err, res) {
                unhook();
                expect(res).to.equal(5);
                expect(output).to.equal('Hello World');
                done();
            });
        });

        it("Use console.log in script", function (done) {
            var script = "console.log('Hello World');";
            var vm = iothubvm();
            vm.runScript(script, function (err, res) {
                expect(err).to.exist;
                done();
            });
        });

        it("Use require in script", function (done) {
            var script = "var testUtil = require('util');" +
                "var testObj = { name: 'test'};" +
                "testUtil.inspect(testObj);";
            var vm = iothubvm();
            vm.runScript(script, function (err, res) {
                expect(err).to.exist;
                done();
            });
        });

        it("Use XMLHttpRequest in script", function (done) {
            var script = "var xhr = XMLHttpRequest();" +
                "xhr.open('GET', 'http://localhost:8080', true);" +
                "xhr.onreadystatechange = function(res) {print(res);};" +
                "xhr.send(null);";
            var vm = iothubvm();
            vm.runScript(script, function (err, res) {
                expect(err).to.exist;
                done();
            });
        });
    });

    describe("Execute code with access to XMLHttpRequest", function () {

        var server;
        var port;

        before(function () {
            var app = express();
            app.get('/', function (req, res, next) {
                res.send('Hello from web server');
            });
            server = app.listen();
            port = server.address().port;
        });

        after(function () {
            server.close();
        });

        it("Use XMLHttpRequest in script", function (done) {
            var script = "var xhr = XMLHttpRequest();" +
                "xhr.open('GET', 'http://localhost:" + port + "', true);" +
                "xhr.onreadystatechange = function(res) {print(res);};" +
                "xhr.send(null);";
            var vm = iothubvm({XMLHttpRequest: true});
            var output;
            var unhook = hook_consolelog(function (msg) {
                output = msg;
            });
            vm.runScript(script, function (err, res) {
                unhook();
                expect(res).to.be.undefined;
                expect(output).to.equal('Hello from web server');
                done();
            });
        });
    });
});
