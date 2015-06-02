var should = require('should'),
sinon = require('sinon'),
ControllerClass = require('./../index');


describe('Controller', function () {
  var ExampleController, ctrl, objs = [];
  
  beforeEach(function (done) {
    ExampleController = class ExampleController extends ControllerClass {

    }
    var req = {
      params: {},
      method: 'GET'
    },
    res = {
      json: function () {}
    },
    next = function () {};
    ctrl = new ExampleController(req, res, next);
    done();
  });


  describe('static members', function () {
    describe('.attach()', function () {
      it('should return route calling Controller constructor', function () {
        var route = ExampleController.attach();
        var save = ExampleController.newInstance;
        ExampleController.newInstance = sinon.spy();
        var req = {},
        res = {},
        next = {};
        route(req, res, next);
        var newInstance = ExampleController.newInstance;
        ExampleController.newInstance = save;
        sinon.assert.calledWith(newInstance, req, res, next);
      });
    });
  });

  describe('constructor(req, res, next)', function () {
    it('should set .req, .res, .next', function () {
      var req = {
        params: {},
        method: 'GET'
      },
      res = {
        json: function () {}
      },
      next = function () {};

      var c = new ExampleController(req, res, next);
      c.req.should.equal(req);
      c.res.should.equal(res);
      c.next.should.equal(next);
    });

    it('should call next() if requested method not found', function () {
      var req = {
        params: {},
        method: 'GET'
      },
      res = {
        json: function () {}
      },
      next = sinon.spy();
      var c = new ExampleController(req, res, next);
      sinon.assert.calledOnce(next);
    });

    it('should call action by HTTP method', function () {
      var spy = sinon.spy();
      class TestController extends ControllerClass {
        getAction() {}
      }
      TestController.prototype.getAction = spy;

      var req = {
        params: {},
        method: 'GET'
      },
      res = {
        json: function () {}
      },
      next = function () {};
      var c = new TestController(req, res, next);
      c.getAction.calledWith(req, res).should.be.ok;
    });

    it('should call `list` action if no action given', function () {
      var spy = sinon.spy();
      class TestController extends ControllerClass {
        listAction() {}
      }
      TestController.prototype.listAction = spy;

      var req = {
        params: {},
        method: 'GET'
      },
      res = {
        json: function () {}
      },
      next = function () {};
      var c = new TestController(req, res, next);
      c.listAction.calledWith(req, res).should.be.ok;
    });

    it('should call action by req.params.action', function () {
      var spy = sinon.spy();
      class TestController extends ControllerClass {
        removeAction() {}
      }
      TestController.prototype.removeAction = spy;

      var req = {
        params: {
          action: 'remove'
        },
        method: 'GET'
      },
      res = {
        json: function () {}
      },
      next = function () {};
      var c = new TestController(req, res, next);
      sinon.assert.calledWith(c.removeAction, req, res);
    });

    it('should set .action to name of action method', function () {
      var spy = sinon.spy();
      class TestController extends ControllerClass {
        removeAction() {}
      }
      TestController.prototype.removeAction = spy;

      var req = {
        params: {
          action: 'remove'
        },
        method: 'GET'
      },
      res = {
        json: function () {}
      },
      next = function () {};
      var c = new TestController(req, res, next);
      c.action.should.equal('removeAction');
    });

    it('should not call action by req.params.action if .actionRouting is false', function () {
      var spy = sinon.spy();
      class TestController extends ControllerClass {
        static actionRouting = false;
        removeAction() {}
      }
      TestController.prototype.removeAction = spy;

      var req = {
        params: {
          action: 'remove'
        },
        method: 'GET'
      },
      res = {
        json: function () {}
      },
      next = sinon.spy();
      var c = new TestController(req, res, next);
      c.removeAction.called.should.be.false;
      next.called.should.be.true;
    });

    it('should not call action by HTTP method if .restfulRouting is false', function () {
      var spy = sinon.spy();
      class TestController extends ControllerClass {
        static restfulRouting = false;
        getAction() {}
      }
      TestController.prototype.getAction = spy;

      var req = {
        params: {},
        method: 'GET'
      },
      res = {
        json: function () {}
      },
      next = sinon.spy();
      var c = new TestController(req, res, next);
      c.getAction.called.should.be.false;
      next.called.should.be.true;
    });

    // do we need this brehaviour?
    // it('should set req.params.id from req.params.action if it number');
    // it('should call action by parsing URL');
  });

it('should call .action if parses URL with query string', function(){
  class Ctrl extends ControllerClass {

  }
  Ctrl.prototype.profileAction = sinon.spy();

  var req = {
    url: 'http://example.com/search/profile#?param1=value1&param2=value2',
    method: 'GET'
  },
  res = { json: sinon.spy() },
  next = sinon.spy();
  var c = new Ctrl(req, res, next);
  c.profileAction.called.should.be.true;
  next.called.should.be.false;
});

describe('.send(content, code, type)', function () {
  it('should call res[type] if type is given', function () {
    ctrl.res.jsonp = sinon.spy();
    ctrl.send('hello', 200, 'jsonp');
    ctrl.res.jsonp.calledWith(200, 'hello').should.be.true;
  });

  it('should call default response method if type is not given', function () {
    ctrl.res.json = sinon.spy();
    ctrl.resFunc = 'json';
    ctrl.send('hello', 200);
    ctrl.res.json.calledWith(200, 'hello').should.be.true;
  });

  it('should call response function without code if it is not given', function () {
    ctrl.res.json = sinon.spy();
    ctrl.send('hello');
    ctrl.res.json.calledWith('hello').should.be.true;
  });
});

describe('.handleException(exception)', function () {
  it('should .send() with error info', function () {
    ctrl.send = sinon.spy();
    var e = new Error('hello');
    ctrl.handleException(e);
    ctrl.send.calledWith({
      message: 'Unhandled exception: ' + e,
      stack: e.stack.split( '\n' )
    }, 500).should.be.true;
  });
});
});
