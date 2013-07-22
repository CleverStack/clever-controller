var cp = require('child_process'),
    cluster = require('cluster'),
    _ = require('underscore'),
    async = require('async');

function masterMain (module, cb) {
    var clientProcessCount = 5;
    var serverProcessCount = require('os').cpus().length;

    _.times(serverProcessCount, function (idx) {
        var server = cluster.fork();

        server.send({
            module: module
        });
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
        cluster.disconnect(function () {
            if (err) {
                return cb && cb(err);
            }

            var result = results.reduce(function (sum, result) {
                return sum + result;
            }, 0) / results.length;

            cb(null, result);
        });
    }
}

if (cluster.isMaster) {
    var jobs = [{
        name: 'clever-controller',
        module: './server'
    }, {
        name: 'raw express.js',
        module: './server-express'
    }];

    // double
    jobs = jobs.concat(jobs);

    async.forEachSeries(jobs, function (job, cb) {
        masterMain(job.module, function (err, avg) {
            if (err) {
                console.error(err);
            } else {
                console.log('%s: avg %d requests per second', job.name, Math.round(1 / avg));
            }

            cb();
        });
    }, function (err) {
    });

}
else {
    process.on('message', function (msg) {
        require(msg.module);
    });
}
