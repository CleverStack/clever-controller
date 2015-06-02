import Class from 'clever-class';
import debugLog from 'debug';
import i from 'i';
import util from 'util';
import _ from 'underscore';
import NoActionException from './exceptions/NoAction';
import injector from 'injector';

let inflect = i();
let debug = debugLog('cleverstack:controllers');

class Controller extends Class {
  static route          = null;
  static service        = false;
  static actionRouting  = true;
  static restfulRouting = true;

  action        = false;
  responseSent  = false;

  static newInstance(req, res, next) {
    return new this(req, res, next);
  }

  static attach() {
    return this.proxy('newInstance');
  }

  static autoRoute(app) {
    if (this.route === null) {
      var name     = this.name.replace('Controller', '').toLowerCase()
        , singular = inflect.singularize(name)
        , plural   = inflect.pluralize(name);

      this.route = [
        `/${singular}/?`,
        `/${singular}/:id/?`,
        `/${singular}/:id/:action/?`,
        `/${plural}/?`,
        `/${plural}/:action/?`
      ]
    }

    var middleware  = []
      , routes      = this.route instanceof Array ? this.route : this.route.split('|');

    debug('Autorouting for route ' + routes.join(', '));

    // Check for middleware that we need to put before the actual attach()
    if (this.autoRouting instanceof Array) {
      debug('Found middleware for ' + routes.join(', ') + ' - ' + util.inspect(this.autoRouting).replace(/\n/ig, ' ') );

      this.autoRouting.forEach(this.proxy(function(mw) {
        middleware.push(typeof mw === 'string' ? this.proxy(mw) : mw);
      }));
    }

    // Add our attach() function to handle requests
    middleware.push(this.attach());

    // Bind the actual routes
    routes.forEach(function(route) {
      var methods = [ 'GET', 'POST', 'PUT', 'DELETE' ];

      debug('Attaching route ' + route);
      if (/(^[^\/]+)\ ?(\/.*)/ig.test(route)) {
        methods = RegExp.$1;
        route   = RegExp.$2;
        methods = methods.match(/\[([^\[\]]+)\]/ig);

        if (methods.length) {
          methods = methods[ 0 ].replace(/(\[|\])/ig, '');
          methods = methods.split(',');
        }
      }

      methods.forEach(function(method) {
        app[method.toLowerCase()].apply(app, [route].concat(middleware));
      });
    });
  }

  constructor(req, res, next) {
    super();

    this.req  = req;
    this.res  = res;
    this.next = next;

    var params;
    try {
      params = this.routeHandler(req, res, next);
    } catch (exception) {
      params = exception;
    }

    return this.dispatch(params[0], params[1], params[2]);
  }

  routeHandler(req, res, next) {
    var methodAction    = req.method.toLowerCase() + 'Action'
      , actionMethod    = /\/([a-zA-z\.]+)(\/?|\?.*|\#.*)?$/ig.test(req.url) ? RegExp.$1 + 'Action' : (req.params.action !== undefined ? req.params.action : false)
      , idRegex         = /(^[0-9]+$|^[0-9a-fA-F]{24}$)/
      , hasIdParam      = req.params && req.params.id !== undefined ? true : false
      , id              = !!hasIdParam && idRegex.test(req.params.id) ? req.params.id : false
      , hasActionParam  = req.params && req.params.action !== undefined ? true : false
      , action          = !!hasActionParam && !idRegex.test(req.params.action) ? req.params.action + 'Action' : false;

    if (!!debug.enabled) {
      debug('methodAction:' + methodAction);
      debug('actionMethod:' + actionMethod);
      debug('actionRouting:' + this.constructor.actionRouting);
      debug('actionMethod:' + actionMethod);
      debug('restfulRouting:' + this.constructor.restfulRouting);
      debug('hasIdParam:' + hasIdParam);
      debug('id:' + id);
      debug('hasActionParam:' + hasActionParam);
      debug('action:' + action);
    }

    if (!!this.constructor.actionRouting && !!hasActionParam && action !== false && typeof this[action] === 'function') {
      if (!!debug.enabled) {
        debug('actionRouting: mapped by url to ' + action);
      }
      return [null, action, next];
    }

    if (actionMethod !== false && typeof this[actionMethod] === 'function') {
      if (!!debug.enabled) {
        debug('actionRouting: mapped by param to ' + actionMethod);
      }
      return [null, actionMethod, next];
    }

    if (!!this.constructor.restfulRouting) {
      if (methodAction === 'getAction' && !id && typeof this.listAction === 'function') {
        methodAction = 'listAction';
      }

      if (typeof this[methodAction] === 'function') {
        if (debug.enabled) {
          debug('restfulRouting mapped to ' + methodAction);
        }
        return [null, methodAction, next];
      }
    }

    return [new NoActionException(), null, next];
  }

  dispatch(error, method, next) {
    if (error && error instanceof NoActionException) {
      if (debug.enabled) {
        debug('No route mapping found, calling next()');
      }
      next();
    } else {
      var exceptionHandler = typeof this.service !== undefined ? 'handleServiceMessage' : 'handleException';
      try {
        if (error) {
          throw error;
        }

        if (method !== null) {
          this.action = method;

          if (debug.enabled) {
            debug('calling ' + this.action);
          }
          var promise = this[method](this.req, this.res);
          if (typeof promise === 'object' && typeof promise.then === 'function' && typeof this.proxy === 'function') {
            promise.then(this.proxy(exceptionHandler)).catch(this.proxy(exceptionHandler));
          }
        } else {
          this.next();
        }

      } catch(e) {
        this[exceptionHandler](e);
      }
    }
  }

  handleServiceMessage(response) {
    if (!!this.responseSent) {
      return;
    }
    
    if (response.statusCode) {
      this.send(response.message, response.statusCode);
    } else if (response instanceof Error) {
      this.send({
        stack      : response.stack ? response.stack.replace(new RegExp(injector.getInstance('appRoot'), 'ig'), '.').split('\n') : response.stack,
        message    : response.message,
        statusCode : 500
      }, 500);
    } else {
      this.send(response, 200);
    }
  }

  handleException(exception) {
    this.send({
      stack   : exception.stack ? exception.stack.split('\n') : undefined,
      message : 'Unhandled exception: ' + exception
    },
    exception.statusCode || 500);
  }

  isGet() {
    return this.req.method.toLowerCase() === 'get';
  }

  isPost() {
    return this.req.method.toLowerCase() === 'post';
  }

  isPut() {
    return this.req.method.toLowerCase() === 'put';
  }

  param(name, defaultVal) {
    return this.req.params[name] || this.req.body[name] || this.req.query[name] || defaultVal;
  }

  send(content, code, responseType = 'json') {
    if (!this.responseSent && !this.req.complete) {
      this.responseSent = true;

      if (code) {
        if (undefined !== this.res.status) {
          this.res.status(code)[responseType](content);
        } else {
          this.res[responseType](code, content);
        }
      } else {
        this.res[responseType](content);
      }
    }
  }
}

// _.extend(Controller, EventEmitter.prototype);

module.exports = Controller;
