/* jshint node: true */
'use strict';

var Class               = require( 'uberclass' )
  , path                = require( 'path' )
  , util                = require( 'util' )
  , i                   = require( 'i' )()
  , debug               = require( 'debug' )( 'clever-controller' )
  , NoActionException   = require('./exceptions/NoAction')
  , routedControllers   = [];

/**
 * Clever Controller - lightning-fast flexible controller prototype
 * 
 * @define {CleverController} Clever Controller Class
 * @type {Class}
 */
var Controller = Class.extend(
/* @Static */
{
    /**
     * Defines any (string) route or (array) routes to be used in conjuction with autoRouting
     *
     * Note:
     *     You do not need to provide a value for this, if autoRouting is enabled,
     *     and you haven't defined a route one will be assigned based on the filename of your Controller.
     *     
     * @examples
     *     route: false
     *     route: '[POST] /example/:id'
     *     route: [
     *         '[POST] /example/?',
     *         '/example/:id/?',
     *         '/example/:id/:action/?',
     *         '/examples/?',
     *         '/examples/:action/?'
     *     ]
     * 
     * @default false
     * @type {Boolean|String|Array}
     */
    route: false,

    /**
     * Turns autoRouting on when not set to false, and when set to an array provides an
     * easy way to define middleware for the controller
     *     
     * @examples
     *     autoRouting: false
     *     autoRouting: [
     *         function( req, res, next ) {
     *             // define middleware here
     *         },
     *         PermissionController.requiresPermission({
     *             all: 'Permission.*'
     *         }),
     *         'controllerFunction' // Where the controller has a function with this name
     *     ]
     * 
     * @default  true
     * @type {Boolean|Array}
     */
    autoRouting: true,

    /**
     * Turns action based routing on or off
     * 
     * @default true
     * @type {Boolean}
     */
    actionRouting: true,

    /**
     * Turns restful method based routing on or off
     * 
     * @default true
     * @type {Boolean}
     */
    restfulRouting: true,

    /**
     * Use this function to attach your controller's to routes (either express or restify are supported)
     * @return {Function} returns constructor function
     */
    attach: function() {
        return this.callback( 'newInstance' );
    },

    /**
     * Class (Static) constructor
     * 
     * @constructor
     * @return {undefined}
     */
    setup: function() {
        if ( this.autoRouting !== false && this.route !== false && routedControllers.indexOf( this.route ) === -1 ) {

            routedControllers.push( this.route );
            
            if ( typeof this.app !== 'undefined' ) {
                this.autoRoute( this.app );
            } else {
                try {
                    var injector = require( 'clever-injector' );
                    injector.inject( this.callback( function( app ) {
                        this.autoRoute( app );
                    }));
                } catch( e ) {
                    debug( 'Unable to autoRoute, Controller.app is not defined and clever-injector attempt failed with: ' + e + ( e.stack || ' Without a StackTrace') );
                }

            }
        }
    },

    /**
     * Attaches controllers routes to the app if autoRouting is enabled and routes have been defined
     * 
     * @param  {Object}     app  Either express.app or restify
     * @return {undefined}
     */
    autoRoute: function( app ) {
        var middleware  = []
          , routes      = this.route instanceof Array ? this.route : this.route.split( '|' );
        
        debug( 'Autorouting for route ' + routes.join( ', ' ) );

        // Check for middleware that we need to put before the actual attach()
        if ( this.autoRouting instanceof Array ) {
            debug( 'Found middleware for ' + routes.join( ', ' ) + ' - ' + util.inspect( this.autoRouting ).replace( /\n/ig, ' ' )  );

            this.autoRouting.forEach( this.callback( function( mw ) {
                middleware.push( typeof mw === 'string' ? this.callback( mw ) : mw );
            }));
        }

        // Add our attach() function to handle requests
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

    /**
     * Use this function to create a new controller that extends from Controller
     * @return {Controller} the newly created controller class
     */
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
                route.push( '[POST] /' + singular + '/?' )
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
    /**
     * The Request Object
     * @type {Request}
     */
    req:        null,

    /**
     * The Response Object
     * @type {Response}
     */
    res:        null,

    /**
     * The next function provided by connect, used to continue past this controller
     * @type {Function}
     */
    next:       null,

    /**
     * Is set to the most recent action function that was called
     * @type {String}
     */
    action:     null,

    /**
     * The name of the default Response handler function
     * 
     * @default 'json'
     * @type {String}
     */
    resFunc:    'json',

    /**
     * This will wrap the performanceSafeSetup() function with a try/catch for safety,
     * most of the actual construction is done inside of Controller.performanceSafeSetup()
     *     
     * @constructor
     * @param  {Request}    req  the Request Object
     * @param  {Response}   res  the Response Object
     * @param  {Function}   next connects next() function
     * @return {Array}           arguments that will be passed to init() to complete the constructor loop
     */
    setup: function( req, res, next ) {
        this.next   = next;
        this.req    = req;
        this.res    = res;

        try {
            return this.performanceSafeSetup( req, res, next );
        } catch( e ) {
            return [ e ];
        }
    },

    /**
     * This is effectively what would be in setup() but instead lives here outside of the try/catch
     * so google v8 can optimise the code within
     * 
     * @param  {Request}    req  the Request Object
     * @param  {Response}   res  the Response Object
     * @param  {Function}   next connects next() function
     * @return {Array}           arguments that will be passed to init() to complete the constructor loop
     */
    performanceSafeSetup: function( req, res, next ) {
        var methodAction    = req.method.toLowerCase() + 'Action'
          , actionRouting   = this.Class.actionRouting
          , actionMethod    = /\/([a-zA-z\.]+)(\/?|\?.*|\#.*)?$/ig.test( req.url ) ? RegExp.$1 + 'Action' : ( req.params.action !== undefined ? req.params.action : false )
          , restfulRouting  = this.Class.restfulRouting
          , idRegex         = /(^[0-9]+$|^[0-9a-fA-F]{24}$)/
          , hasIdParam      = req.params && req.params.id !== undefined ? true : false
          , id              = !!hasIdParam && idRegex.test( req.params.id ) ? req.params.id : false
          , hasActionParam  = req.params && req.params.action !== undefined ? true : false
          , action          = !!hasActionParam && !idRegex.test( req.params.action ) ? req.params.action + 'Action' : false;

        debug( 'methodAction:' + methodAction );
        debug( 'actionMethod:' + actionMethod );
        debug( 'actionRouting:' + actionRouting );
        debug( 'actionMethod:' + actionMethod );
        debug( 'restfulRouting:' + restfulRouting );
        debug( 'hasIdParam:' + hasIdParam );
        debug( 'id:' + id );
        debug( 'hasActionParam:' + hasActionParam );
        debug( 'action:' + action );

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

    /**
     * The final function in the constructor routine, called eventually after setup() has finished
     * 
     * @param  {Error}    error  any errors encountered during the setup() portion of the constructor
     * @param  {String}   method the name of the method to call on this controller
     * @param  {Function} next   connects next() function
     * @return {undefined}
     */
    init: function( error, method, next ) {
        if ( error && error instanceof NoActionException ) {
            debug( 'No route mapping found, calling next()' );
            next();
        } else {
            try {
                if ( error ) {
                    throw error;
                }

                if ( method !== null ) {
                    this.action = method;

                    debug( 'calling ' + this.action );
                    var promise = this[ method ]( this.req, this.res );
                    if ( typeof promise === 'object' && typeof promise.then === 'function' && typeof this.proxy === 'function' ) {
                        promise.then( this.proxy( 'handleServiceMessage' ) ).catch( this.proxy( 'handleServiceMessage' ) );
                    }
                } else {
                    this.next();
                }

            } catch( e ) {
                this.handleException( e );
            }
        }
    },

    send: function( content, code, type ) {
        if ( !this.responseSent && !this.res.complete ) {
            this.responseSent = true;
            var toCall = type || this.resFunc;
            if ( code ) {
                if ( undefined !== this.res.status ) {
                    this.res.status( code )[ toCall ]( content );
                } else {
                    this.res[ toCall ]( code, content );
                }
            } else {
                this.res[ toCall ]( content );
            }
        }
    },

    render: function( template, data ) {
        this.res.render( template, data );
    },

    handleServiceMessage: function( exception ) {
        return this.handleException( exception );
    },

    handleException: function( exception ) {
        this.send({
            message: 'Unhandled exception: ' + exception,
            stack: exception.stack ? exception.stack.split( '\n' ) : undefined
        },
        exception.statusCode || 500 );
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

module.exports = Controller;