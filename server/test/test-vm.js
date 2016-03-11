'use strict';

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

    describe("Execute code with function calls in script", function () {
        it("Do function call inside script", function (done) {
            var script = [
                "var r = function(){print('Hello from function')};",
                "r();"
            ].join('');
            var output;
            var unhook = hook_consolelog(function (msg) {
                output = msg;
            });
            var vm = iothubvm();
            vm.runScript(script, function (err, res) {
                unhook();
                expect(output).to.equal('Hello from function');
                done();
            });
        });

        it("Do function call with arguments inside script", function (done) {
            var script = [
                "var message = 'Hello from function';",
                "var r = function(message){print(message); return 5;};",
                "r(message);"
            ].join('');
            var output;
            var unhook = hook_consolelog(function (msg) {
                output = msg;
            });
            var vm = iothubvm();
            vm.runScript(script, function (err, res) {
                unhook();
                expect(output).to.equal('Hello from function');
                expect(res).to.equal(5);
                done();
            });
        });

        it("Run fibonacci algorithm inside script", function (done) {
            var script = [
                "function wrapper(){",
                    "var recursive = function(n) {",
                        "if(n <= 2) {",
                            "return 1;",
                        "} else {",
                            "return recursive(n - 1) + recursive(n - 2);",
                        "}",
                    "};",
                    "var iterations = [28, 30, 32];",
                    "var start = null,",
                        "end = null,",
                        "time = null,",
                        "times = [],",
                        "count = 0;",
                    "for (var i = 0; i < iterations.length; i++) {",
                        "count++;",
                        "start = new Date().getTime();",
                        "recursive(iterations[i]);",
                        "end = new Date().getTime();",
                        "time = end - start;",
                        "times.push(time);",
                    "}",
                    "return count;",
                "}",
                "wrapper();"
            ].join('');
            var vm = iothubvm();
            vm.runScript(script, function (err, res) {
                expect(res).to.equal(3);
                done();
            });
        });


        it("Run quicksort algorithm inside script", function (done) {
            var script = [
                "function wrapper(){",
                    "function quickSort(limit) {",
                        "var nums = [];",
                        "for (var i = 0; i<limit; i++) {",
                          "nums[i] = Math.random();",
                        "}",
                        "var start = new Date().getTime();",
                        "nums.sort();",
                        "var end = new Date().getTime();",
                        "var time = end - start;",
                        "return time;",
                      "};",
                      "var times = [",
                        "quickSort(15000),",
                        "quickSort(20000),",
                        "quickSort(25000),",
                      "];",
                    "return 'Done';",
                "}",
                "wrapper();"
            ].join('');
            var vm = iothubvm();
            vm.runScript(script, function (err, res) {
                expect(res).to.equal('Done');
                done();
            });
        });

        it("Run newton algorithm inside script", function (done) {
            var script = [
                "function wrapper(){",
                    "function sqrt(x) {",
                        "var count = 8;",
                        "function iterate(estimate) {",
                            "count = count - 1;",
                            "if (count < 1) {",
                                "return estimate;",
                            "} else {",
                                "return iterate((estimate + x/estimate) / 2);",
                            "}",
                        "}",
                        "return iterate(x);",
                    "}",
                    "function newton(limit) {",
                        "var start = null,",
                            "end = null,",
                            "time = null,",
                            "rand = Math.random();",
                        "start = new Date().getTime();",
                        "for (var i = 0; i < limit; i++) {",
                            "sqrt(rand);",
                        "}",
                        "end = new Date().getTime();",
                        "time = end - start;",
                        "return time;",
                    "}",
                    "var iterations = [60000, 80000, 100000],",
                        "times = [];",
                    "var len = iterations.length;",
                    "for (var i = 0; i < len; i++) {",
                        "time = newton(iterations[i]);",
                        "times.push(time);",
                    "}",
                    "return 'Done';",
                "}",
                "wrapper();"
            ].join('');
            var vm = iothubvm();
            vm.runScript(script, function (err, res) {
                expect(res).to.equal('Done');
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
