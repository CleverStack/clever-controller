/* jshint node: true */
'use strict';

var NoActionException = require('./exceptions/NoAction')
  , Class = require( 'uberclass' )
  , path = require( 'path' )
  , util = require( 'util' )
  , i = require( 'i' )()
  , debug = require( 'debug' )( 'clever-controller' )
  , routedControllers = [];

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
        if ( this.autoRouting !== false && this.route !== false && routedControllers.indexOf( this.route ) === -1 ) {
            // Do not route multiple times
            routedControllers.push( this.route );
            
            if ( typeof this.app !== 'undefined' ) {

                // app has been provided for us in the Static of this Controller so we can attach our routes to it
                this.autoRoute( this.app );

            } else if ( typeof injector !== 'undefined' ) {
                
                // Use the clever-injector to get the express app so we can attach our routes to it
                injector.inject( function( app ) {
                    self.autoRoute( app );
                });

            }
        }
    },

    autoRoute: function( app ) {
        var middleware = []
          , routes = this.route.split( '|' )
        
        debug( 'Autorouting for route ' + routes.join( ', ' ) );

        // Check for middleware that we need to put before the actual attach()
        if ( this.autoRouting instanceof Array ) {
            debug( 'Found middleware for ' + routes.join( ', ' ) + ' - ' + util.inspect( this.autoRouting ).replace( /\n/ig, ' ' )  );

            this.autoRouting.forEach(function( mw ) {
                middleware.push( typeof mw === 'string' ? this.callback( mw ) : mw );
            }.bind( this ));
        }

        // Add our attach() function
        middleware.push( this.attach() );

        // Bind the actual routes
        routes.forEach(function( route ) {
            var actionIdRoute = [ route, ':action', ':id?' ].join( '/' )
              , actionRoute = [ route, ':action?' ].join( '/' );

            debug( 'Attaching route ' + actionIdRoute );
            app.all.apply( app, [ actionIdRoute ].concat( middleware ) ); // /example/:action/:id?
            
            debug( 'Attaching route ' + actionRoute );
            app.all.apply( app, [ actionRoute ].concat( middleware ) ); // /example/?:action?
        });
    },

    extend: function() {
        var extendingArgs = [].slice.call( arguments )
          , autoRouting = ( extendingArgs.length === 2 )
                ? extendingArgs[ 0 ].autoRouting !== false
                : this.autoRouting
          , definedRoute = ( extendingArgs.length === 2 )
                ? extendingArgs[ 0 ].route !== undefined
                : this.route;

        // Figure out if we are autoRouting and do not have a defined route already
        if ( autoRouting && !definedRoute ) {
            var stack = new Error().stack.split( '\n' )
              , stack = stack.splice( 1, stack.length - 1 )
              , extendingFilePath = false
              , extendingFileName = false
              , route = null;
            
            // Walk backwards over the stack to find the filename where this is defined
            while( stack.length > 0 && extendingFilePath === false ) {
                var file = stack.shift();
                if ( !/clever-controller/ig.test( file ) && !/uberclass/ig.test( file ) ) {
                    if ( /\(([^\[\:]+).*\)/ig.test( file ) ) {
                        extendingFilePath = RegExp.$1;
                        extendingFileName = path.basename( extendingFilePath );
                    }
                }
            }

            // Determine the route names if we have found a file
            if ( [ '', 'controller.js' ].indexOf( extendingFileName.toLowerCase() ) === -1 ) {
                var singular = i.singularize( extendingFileName.replace( /(controller)?.js/ig, '' ).toLowerCase() )
                  , plural = i.pluralize( singular );

                route = [ '/', singular, '|', '/', plural ].join('');

                if ( extendingArgs.length === 2 ) {
                    extendingArgs[ 0 ].route = route;
                } else {
                    extendingArgs.unshift({ route: route  });
                }
            }
        }

        // Call extend on the parent
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
            return this.performanceSafeSetup( req, res, next );
        } catch( e ) {
            return [ e ];
        }
    },

    performanceSafeSetup: function( req, res, next ) {
        var method = null
          , funcName = null
          , parts = null;

        this.next = next;
        this.req = req;
        this.res = res;

        // Override routes where you attach specifically to a single route
        if ( this.Class.actionRouting && /\//.test( this.req.url ) ) {
            parts = this.req.url.split( '/' );
            funcName = parts[ parts.length - 1 ];
            
            if(/\#|\?/.test(funcName)){
                funcName = funcName.split( /\#|\?/ )[ 0 ];
            }

            if ( isNaN( funcName ) ) {
                funcName = funcName + 'Action';
                if ( typeof this[ funcName ] == 'function' ) {
                    debug( 'actionRouting mapped to ' + funcName );

                    return [ null, funcName, next ];
                }
            }
        }

        // Route based on an action first if we can
        if ( this.Class.actionRouting && typeof this.req.params !== 'undefined' && typeof this.req.params.action !== 'undefined' ) {
            // Action Defined Routing
            // Updated to consider ObjectId's as numbers for Mongo ids
            if ( !/^[0-9a-fA-F]{24}$/.test( this.req.params.action ) && isNaN( this.req.params.action ) ) {
                funcName = this.req.params.action + 'Action';

                if ( typeof this[ funcName ] == 'function' ) {
                    debug( 'actionRouting mapped to ' + funcName );
                    return [ null, funcName, next ];
                } else {
                    throw new NoActionException();
                }
            } else {
                // HTTP Method Based Routing
                method = this.req.method.toLowerCase() + 'Action';
                if ( typeof this[ method ] == 'function' ) {
                    debug( 'http method route mapped to ' + method );

                    this.req.params.id = this.req.params.action;
                    delete this.req.params.action;

                    return [ null, method, next ];
                } else {
                    throw new NoActionException();
                }
            }
        }

        // Route based on the HTTP Method, otherwise throw an exception
        if ( this.Class.restfulRouting ) {
            if ( this.isGet() && ( this.req.params === undefined || this.req.params.id === undefined ) && typeof this.listAction === 'function' ) {
                method = 'listAction';

                debug( 'restfulRouting mapped to ' + method );
            } else {
                method = this.req.method.toLowerCase() + 'Action';
                if ( typeof this[ method ] != 'function' ) {
                    throw new NoActionException();
                }

                debug( 'restfulRouting mapped to ' + method );
            }
        }

        // If we got this far without an action but with a method, then route based on that
        return [ null, method, next ];
    },

    init: function( error, method, next ) {
        if ( error && error instanceof NoActionException ) {
            debug( 'No route mapping found, calling next()' );

            this.next();
        } else {
            try {
                if ( error )
                    throw error;

                if ( method !== null ) {
                    this.action = method;

                    debug( 'calling ' + this.action );
                    this[ method ]( this.req, this.res );
                } else {
                    this.next();
                }

            } catch( e ) {
                this.handleException( e );
            }
        }
    },

    send: function( content, code, type ) {
        var toCall = type || this.resFunc;
        if ( code ) {
            this.res[ toCall ]( code, content );
        } else {
            this.res[ toCall ]( content );
        }
    },

    render: function( template, data ) {
        this.res.render( template, data );
    },

    handleException: function( exception ) {
        this.send( { error: 'Unhandled exception: ' + exception, stack: exception.stack }, 500 );
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