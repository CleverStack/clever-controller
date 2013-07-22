var cp = require('child_process'),
    cluster = require('cluster'),
    _ = require('underscore'),
    async = require('async');

function masterMain () {
    var clientProcessCount = 5;
    var serverProcessCount = require('os').cpus().length;

    _.times(serverProcessCount, function (idx) {
        cluster.fork();
    });

    async.times(clientProcessCount, function (idx, cb) {
        var client = cp.fork(__dirname + '/client');

        client.on('message', function (result) {
            cb(null, result);
        });

        client.on('exit', function () {
            console.log('Client exited');
        });
    }, finish);

    function finish (err, results) {
        if (err) {
            console.error(err);
        }

        var result = results.reduce(function (sum, result) {
            return sum + result;
        }, 0) / results.length;

        console.log('Average %d requests per second', Math.round(1 / result));
        cluster.disconnect();
    }
}

if (cluster.isMaster) {
    console.log('master');
    masterMain();
}
else {
    require('./server');
}
