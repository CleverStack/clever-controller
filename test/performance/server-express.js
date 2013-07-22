var express = require('express');

var app = express();
app.use(app.router);

app.all('/example/:action/:id?', function (req, res, next) {
    next();
});

app.all('/example/?:action?', function (req, res, next) {
    res.json({
        status: 'Sending you the list of examples.'
    });
});

app.listen(9999, function () {
    console.log('Server listening');
});
