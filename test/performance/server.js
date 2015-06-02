var express    = require('express')
  , Controller = require('../../index');

var app = express();
app.use(app.router);

class ExampleController extends Controller {
  listAction() {
    this.send({
      status: 'Sending you the list of examples.'
    });
  }
}

ExampleController.autoRoute(app);

// app.listen(9999, function () {
  //console.log('Server listening');
});
