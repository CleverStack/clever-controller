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
        var middleware  = []
          , routes      = this.route instanceof Array ? this.route : this.route.split( '|' );
        
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
            var methods = [ 'GET', 'POST', 'PUT', 'DELETE' ];

            debug( 'Attaching route ' + route );
            if ( /(^[^\/]+)\ ?(\/.*)/ig.test( route ) ) {
                methods = RegExp.$1;
                route   = RegExp.$2;
                methods = methods.match( /\[([^\[\]]+)\]/ig );

                if ( methods.length ) {
                    methods = methods[ 0 ].replace( /(\[|\])/ig, '' );
                    methods = methods.split( ',' );
                }
            }

            methods.forEach( function( method ) {
                app[ method.toLowerCase() ].apply( app, [ route ].concat( middleware ) );
            });
        });
    },

    extend: function() {
        var extendingArgs = [].slice.call( arguments )
          , autoRouting = ( extendingArgs.length === 2 ) ? extendingArgs[ 0 ].autoRouting !== false : this.autoRouting
          , definedRoute = ( extendingArgs.length === 2 ) ? extendingArgs[ 0 ].route !== undefined : this.route;

        // Figure out if we are autoRouting and do not have a defined route already
        if ( autoRouting && !definedRoute ) {
            var stack = new Error().stack.split( '\n' )
              , extendingFilePath = false
              , extendingFileName = false
              , route = null;

            stack = stack.splice( 1, stack.length - 1 );
            
            // Walk backwards over the stack to find the filename where this is defined
            while( stack.length > 0 && extendingFilePath === false ) {
                var file = stack.shift();
                if ( !/clever-controller/ig.test( file ) && !/uberclass/ig.test( file ) ) {
                    if ( /.*\(([^\)]+)\:.*\:.*\)/ig.test( file ) ) {
                        extendingFilePath = RegExp.$1;
                        extendingFileName = path.basename( extendingFilePath );
                    }
                }
            }

            // Determine the route names if we have found a file
            if ( [ '', 'controller.js' ].indexOf( extendingFileName.toLowerCase() ) === -1 ) {
                var singular = i.singularize( extendingFileName.replace( /(controller)?.js/ig, '' ).toLowerCase() )
                  , plural = i.pluralize( singular );

                route = [];
                route.push( '/' + singular + '/:id/?' );
                route.push( '/' + singular + '/:id/:action/?' );
                route.push( '/' + plural + '/?' );
                route.push( '/' + plural + '/:action/?' );

                route = route.join( '|' );

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

    setup: function( req, res, next ) {
        this.next = next;
        this.req  = req;
        this.res  = res;

        try {
            return this.performanceSafeSetup( req, res, next );
        } catch( e ) {
            return [ e ];
        }
    },

    performanceSafeSetup: function( req, res, next ) {
        var methodAction    = req.method.toLowerCase() + 'Action'
          , actionRouting   = this.Class.actionRouting
          , actionMethod    = /\/([a-zA-z]+)(\/?|\?.*|\#.*)?$/ig.test( req.url ) ? RegExp.$1 + 'Action' : ( req.params.action !== undefined ? req.params.action : false )
          , restfulRouting  = this.Class.restfulRouting
          , idRegex         = /(^[0-9]+$|^[0-9a-fA-F]{24}$)/
          , hasIdParam      = req.params && req.params.id !== undefined ? true : false
          , id              = !!hasIdParam && idRegex.test( req.params.id ) ? req.params.id : false
          , hasActionParam  = req.params && req.params.action !== undefined ? true : false
          , action          = !!hasActionParam && !idRegex.test( req.params.action ) ? req.params.action + 'Action' : false;

        // console.log( 'methodAction:' + methodAction );
        // console.log( 'actionMethod:' + actionMethod );
        // console.log( 'actionRouting:' + actionRouting );
        // console.log( 'actionMethod:' + actionMethod );
        // console.log( 'restfulRouting:' + restfulRouting );
        // console.log( 'hasIdParam:' + hasIdParam );
        // console.log( 'id:' + id );
        // console.log( 'hasActionParam:' + hasActionParam );
        // console.log( 'action:' + action );

        if ( !!actionRouting && !!hasActionParam && action !== false && typeof this[ action ] === 'function' ) {
            debug( 'actionRouting: mapped by url to ' + action );
            return [ null, action, next ];
        }

        if ( actionMethod !== false && typeof this[ actionMethod ] === 'function' ) {
            debug( 'actionRouting: mapped by param to ' + actionMethod );
            return [ null, actionMethod, next ];
        }

        if ( !!restfulRouting ) {
            if ( methodAction === 'getAction' && !id && typeof this.listAction === 'function' ) {
                methodAction = 'listAction';
            }

            if ( typeof this[ methodAction ] === 'function' ) {
                debug( 'restfulRouting mapped to ' + methodAction );
                return [ null, methodAction, next ];
            }
        }

        return [ new NoActionException(), null, next ];
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