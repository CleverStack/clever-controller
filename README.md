# clever-controller  [![Build Status](https://travis-ci.org/clevertech/clever-controller.png)](https://travis-ci.org/clevertech/clever-controller)
## Lightning-fast flexible controller prototype
The main aim of the controller is to help simplify the most common tasks that you need to do when setting up routes and functions/classes to handle them. 

### Installation:
It is published in `npm` so a simple `npm install clever-controller` will suffice.

### Routing:

```javascript
// Default route setup ~ '/example' or '/example/' or '/example/hello'
app.all('/example/?:action?', ExampleController.attach())

// Action + ID Routes setup ~ '/example/custom/12'
app.all('/example/:action/:id?', ExampleController.attach())

// A common use/place for middleware in a controller
app.use(ExampleController.someMiddleware);
```

**Note:** if you use both types of routes, be sure to place your routes in this order

We use Express' routing, so be sure to check it out at http://expressjs.com/api.html#app.VERB

### Making A Controller:

```javascript
module.exports = ExampleController = function() {
	return Controller.extend(
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

### Defining middleware
```javascript
module.exports = ExampleController = function() {
	return Controller.extend(
	{
		someMiddleware: function(req, res, next) {
			res.send({
				message: 'Hi from middleware!'
			});
		}
	},
	{
		// example that returns JSON, available from route '/example/hello'
		helloAction: function() {
			this.send({
				message: 'Hi there'
			})
		}
	});
};
```

### RESTful Actions

```javascript
module.exports = ExampleController = function() {
	return Controller.extend(
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

When doing a `GET /example` it will route to either `listAction` first OR `getAction` if listAction is not defined.

If neither are defined, express's `.next()` function will be called allowing it to fall through the controller and move onto any other middleware you may have configured.

If you want `/example/hello` as a route, you can simply implement `helloAction` in your controller and it will be automatically routed to it.

This is the default way to setup a controller to use actions. By default you can also visit `/example/12` and it will route to the `getAction` function in your controller (if it's defined) with `this.req.params.id` set for you to use (the same applies for all HTTP methods, eg PUT/DELETE/POST/et cetera)


### Performance (Tests folder 'performance-tests')
```
node test/performance/master.js
clever-controller: 1 server, 1 client processes: avg 2742 req/second (2726, 2758)
clever-controller: 2 server, 1 client processes: avg 2764 req/second (2784, 2745)
clever-controller: 3 server, 1 client processes: avg 2669 req/second (2671, 2668)
clever-controller: 4 server, 1 client processes: avg 2676 req/second (2688, 2664)
clever-controller: 5 server, 1 client processes: avg 2715 req/second (2773, 2661) *
raw express.js: 1 server, 1 client processes: avg 2766 req/second (2743, 2790)
raw express.js: 2 server, 1 client processes: avg 2793 req/second (2780, 2807)
raw express.js: 3 server, 1 client processes: avg 2730 req/second (2743, 2717)
raw express.js: 4 server, 1 client processes: avg 2710 req/second (2722, 2699)
raw express.js: 5 server, 1 client processes: avg 2635 req/second (2712, 2562) *
```

### Testing: 

```
npm test
```
