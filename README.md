clever-controller
=================

NodeJS MVC Style "Controller"

"npm install clever-controller"

### Making A Controller:

```javascript
module.exports = ExampleController = function() {
	return (require('./../classes/Controller.js')).extend(
	{
		// example that returns JSON, available from route '/example/hello'
		helloAction: function() {
			this.send({
				message: 'Hi there'
			})
		},

		// example that renders a view, available from route '/example/view'
		viewAction: function() {
			this.render('view.ejs', {});
		}
	});
};
```

### RESTful Actions

```javascript
module.exports = ExampleController = function() {
	return (require('./../classes/Controller.js')).extend(
	{
		postAction: function() {
			this.send({
				status: 'Created record!' 
			});
		},

		listAction: function() {
			this.send({
				status: 'Sending you the list of examples.'
			});
		},

		getAction: function() {
			this.send({
				status: 'sending you record with id of ' + this.req.params.id
			});
		},

		putAction: function() {
			this.send({
				status: 'updated record with id ' + this.req.params.id
			});
		},

		deleteAction: function() {
			this.send({
				status: 'deleted record with id ' + this.req.params.id
			});
		}
	});
};
```

### Making Actions:

When doing a 'GET /example' it will route to either listAction() first OR getAction() if listAction is not defined.

If neither are defined, express's `.next()` function will be called allowing it to fall through the controller and move onto any other middleware you may have configured.

If you want '/example/hello' as a route, you can simply implement helloAction() in your controller and it will be automatically routed to it.

This is the default way to setup a controller to use actions, by default you can also visit '/example/12' and it will route to the getAction() function in your controller (if it's defined) with `this.req.params.id` set for you to use (the same applies for all http methods, eg PUT/DELETE/POST/GET etc.).