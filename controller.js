/* jshint node: true */
'use strict';

var NoActionException = require('./exceptions/NoAction')
  , Class = require( 'uberclass' )
  , path = require( 'path' );

module.exports = Class.extend(
/* @Static */
{
    route: false,

    autoRouting: true,

    actionRouting: true,

    restfulRouting: true,

    attach: function() {
        return this.callback( 'newInstance' );
    },

    setup: function() {
        var self = this;
        if ( typeof injector !== 'undefined' && this.autoRouting !== false && this.route !== false ) {
            injector.inject( function( app ) {
                self.autoRoute( app );
            });
        }
    },

    autoRoute: function( app ) {
        var middleware = [];

        if ( this.autoRouting instanceof Array ) {
            this.autoRouting.forEach(function( mw ) {
                middleware.push( typeof mw === 'string' ? this.callback( mw ) : mw );
            }.bind( this ));
        }

        middleware.push( this.attach() );

        app.all.apply( app, [ [ this.route, ':action', ':id?' ].join( '/' ) ].concat( middleware ) ); // /example/:action/:id?
        app.all.apply( app, [ [ this.route, ':action?' ].join( '/' ) ].concat( middleware ) ); // /example/?:action?
    },

    extend: function() {
        var extendingArgs = [].slice.call( arguments )
          , autoRouting = ( extendingArgs.length === 2 )
                ? extendingArgs[ 0 ].autoRouting !== false
                : false
          , definedRoute = ( extendingArgs.length === 2 )
                ? extendingArgs[ 0 ].route !== undefined
                : false;

        if ( autoRouting && !definedRoute ) {
            var stack = new Error().stack.split( '\n' )
              , stack = stack.splice( 1, stack.length - 1)
              , extendingFilePath = false
              , extendingFileName = false
              , route = null;
            
            while( stack.length > 0 && extendingFilePath === false ) {
                var file = stack.shift();
                if ( !/clever-controller/ig.test( file ) && !/uberclass/ig.test( file ) ) {
                    if ( /\(([^\[\:]+).*\)/ig.test( file ) ) {
                        extendingFilePath = RegExp.$1;
                        extendingFileName = path.basename( extendingFilePath ).replace( /(controller)?.js/ig, '' ).toLowerCase();
                    }
                }
            }

            if ( [ '', 'controller' ].indexOf( extendingFileName ) === -1 && this.route === false ) {
                route = [ '/', extendingFileName ].join('');
                // debug( 'Binding automatic route name??' )
                if ( extendingArgs.length === 2 ) {
                    extendingArgs[ 0 ].route = route;
                } else {
                    extendingArgs.unshift({ route: route  });
                }
            }
        }

        
        return this._super.apply( this, extendingArgs );
    }
},
/* @Prototype */
{
    req: null,
    res: null,
    next: null,
    resFunc: 'json',
    action: null,

    setup: function(req, res, next) {
        try {
            return this.performanceSafeSetup(req, res, next);
        } catch(e) {
            return [e];
        }
    },

    performanceSafeSetup: function(req, res, next) {
        var method = null,
            funcName = null;

        this.next = next;
        this.req = req;
        this.res = res;

        // Override routes where you attach specifically to a single route
        if (this.Class.actionRouting && /\//.test(this.req.url)) {
            var parts = this.req.url.split('/');
            funcName = parts[parts.length-1];
            
            if(/\#|\?/.test(funcName)){
                funcName = funcName.split(/\#|\?/)[0];
            }

            if (isNaN(funcName)) {
                funcName = funcName + 'Action';
                if (typeof this[funcName] == 'function') {
                    return [null, funcName, next];
                }
            }
        }

        // Route based on an action first if we can
        if (this.Class.actionRouting && typeof this.req.params !== 'undefined' && typeof this.req.params.action !== 'undefined') {
            // Action Defined Routing
            if (isNaN(this.req.params.action)) {
                funcName = this.req.params.action + 'Action';

                if (typeof this[funcName] == 'function') {
                    return [null, funcName, next];
                } else {
                    throw new NoActionException();
                }
            } else {
                // HTTP Method Based Routing
                method = this.req.method.toLowerCase() + 'Action';
                if (typeof this[method] == 'function') {

                    this.req.params.id = this.req.params.action;
                    delete this.req.params.action;

                    return [null, method, next];
                } else {
                    throw new NoActionException();
                }
            }
        }

        // Route based on the HTTP Method, otherwise throw an exception
        if (this.Class.restfulRouting) {
            if (this.isGet() && (this.req.params === undefined || this.req.params.id === undefined) && typeof this.listAction === 'function') {
                method = 'listAction';
            } else {
                method = this.req.method.toLowerCase() + 'Action';
                if (typeof this[method] != 'function') {
                    throw new NoActionException();
                }
            }
        }

        // If we got this far without an action but with a method, then route based on that
        return [null, method, next];
    },

    init: function(error, method, next) {
        if (error && error instanceof NoActionException) {
            this.next();
        } else {
            try {
                if (error)
                    throw error;

                if (method !== null) {
                    this.action = method;
                    this[method](this.req, this.res);
                } else {
                    this.next();
                }

            } catch(e) {
                this.handleException(e);
            }
        }
    },

    send: function(content, code, type) {
        var toCall = type || this.resFunc;
        if (code) {
            this.res[toCall](code, content);
        } else {
            this.res[toCall](content);
        }
    },

    render: function(template, data) {
        this.res.render(template, data);
    },

    handleException: function(exception) {
        this.send({ error: 'Unhandled exception: ' + exception, stack: exception.stack }, 500);
    },

    isGet: function() {
        return this.req.method.toLowerCase() === 'get';
    },

    isPost: function() {
        return this.req.method.toLowerCase() === 'post';
    },

    isPut: function() {
        return this.req.method.toLowerCase() === 'put';
    }
});