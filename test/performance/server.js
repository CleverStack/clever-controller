var express = require('express'),
    Controller = require('../../controller');

var app = express();
app.use(app.router);

var ExampleController = Controller.extend({
    listAction: function() {
        this.send({
            status: 'Sending you the list of examples.'
        });
    }
});

app.all('/example/:action/:id?', ExampleController.attach());
app.all('/example/?:action?', ExampleController.attach());

app.listen(9999, function () {
    //console.log('Server listening');
});
