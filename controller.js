var NoActionException = require( './exceptions/NoAction' ),
    Class = require( 'uberclass' );

module.exports = Class.extend(
/* @Static */
{
    /**
     * Turn on the actions for your controller. (Hint: if its a RESTful API controller you may only need httpMethodsEnabled?)
     * @type {Boolean}
     */
    actionsEnabled: true,

    /**
     * Turn on the ability to route automatically to "getAction", "postAction" etc
     * @type {Boolean}
     */
    httpMethodsEnabled: true,

    /**
     * Use this function to attach your controllers to routes, you can "LOCK" it to only responding to one action by providing its name here.
     * (The name of the method you want to call in the controller's prototype)
     * 
     * @param  {String}   action  The override action (name, as a string) to route to
     * @return {Function} Lambda calculus
     */
    attach: function( action ) {
        action = action !== undefined
            ? action
            : null;

        return this.callback( 'newInstance', action );
    }
},
/* @Prototype */
{
    /**
     * @attribute {Object} req
     * The express request object
     */
    req: null,

    /**
     * @attribute {Object} res
     * The express response object
     */
    res: null,

    /**
     * @attribute {Function} next
     * The express next function used to continue routing
     */
    next: null,

    /**
     * @attribute {String} resFunc
     * The express response function to use ('json' or 'send', defaults to 'json')
     */
    resFunc: 'json',

    /**
     * @attribute {Object} req
     * The express request object
     */
    action: null,

    /**
     * This constructor function calls another method because of performance issues with using try/catch (JIT BAILOUT)
     * 
     * @constructor
     * @param  {String}   action  The override action passed down through the newInstance proxy
     * @param  {Request}  req     The express request object
     * @param  {Response} res     The express response object
     * @param  {Function} next    The express next function
     * @return {Array} The array returned by this is the arguments passed into this.init()
     */
    setup: function( action, req, res, next ) {
        try {
            return this.performanceSafeSetup( action, req, res, next );
        } catch(e) {
            return [e];
        }
    },

    /**
     * Where the logic for this.setup() really happens, because there is no try/catch in this function it can be optimized by V8's Optimizing Compiler.
     * 
     * @param  {String}   action  The override action passed down through the newInstance proxy
     * @param  {Request}  req     The express request object
     * @param  {Response} res     The express response object
     * @param  {Function} next    The express next function
     * @return {Array} This returns the array for this.setup() to pass onto this.init()
     */
    performanceSafeSetup: function( action, req, res, next ) {
        var method = null,
            funcName = null;

        this.next = next;
        this.req = req;
        this.res = res;

        // Implement override action functionality
        if ( this.Class.actionsEnabled && action !== null ) {
            if ( typeof this[ action ] == 'function' ) {
                return [ null, action, next ];
            } else {
                throw new NoActionException();
            }
        }

        // Override routes where you attach specifically to a single route
        if ( this.Class.actionsEnabled && /\//.test( this.req.url ) ) {
            var parts = this.req.url.split( '/' );
            funcName = parts[ parts.length - 1 ];
            if ( isNaN( funcName ) ) {
                funcName = funcName + 'Action';
                if (typeof this[ funcName ] == 'function') {
                    return [ null, funcName, next ];
                }
            }
        }

        // Route based on an action first if we can
        if ( this.Class.actionsEnabled && typeof this.req.params.action != 'undefined' ) {
            // Action Defined Routing
            if ( isNaN( this.req.params.action ) ) {
                funcName = this.req.params.action + 'Action';

                if (typeof this[ funcName ] == 'function') {
                    return [ null, funcName, next ];
                } else {
                    throw new NoActionException();
                }
            } else {
                // HTTP Method Based Routing
                method = this.req.method.toLowerCase() + 'Action';
                if (typeof this[ method ] == 'function') {

                    this.req.params.id = this.req.params.action;
                    delete this.req.params.action;

                    return [ null, method, next ];
                } else {
                    throw new NoActionException();
                }
            }
        }

        // Route based on the HTTP Method, otherwise throw an exception
        if ( this.Class.httpMethodsEnabled ) {
            if ( this.isGet() && (this.req.params === undefined || this.req.params.id === undefined) && typeof this.listAction == 'function' ) {
                method = 'listAction';
            } else {
                method = this.req.method.toLowerCase() + 'Action';
                if ( typeof this[ method ] != 'function' ) {
                    throw new NoActionException();
                }
            }
        }

        // If we got this far without an action but with a method, then route based on that
        return [ null, method, next ];
    },

    /**
     * The last part of the constructor loop, this function determines based on the result of this.setup() what it should respond with (or if it should just call next)
     * 
     * @param  {Mixed}    error   Any error encountered while trying to setup this instance
     * @param  {String}   method  The name of the method we need to call
     * @param  {Function} next    Express's Next function
     * @return {null}
     */
    init: function( error, method, next ) {
        if ( error && error instanceof NoActionException ) {
            this.next();
        } else {
            try {
                if ( error )
                    throw error;

                this.performanceInit( method );
            } catch(e) {
                this.handleException( e );
            }
        }
    },

    /**
     * Performance safe execution of the action, called by init()
     * 
     * @param  {String} method The name of the method we need to call
     * @return {null}
     */
    performanceInit: function( method ) {
        if ( method !== null ) {
            this.action = method;
            this[ method ]( this.req, this.res );
        } else {
            this.next();
        }
    },

    /**
     * Helpful function to use with express templates
     * 
     * @param  {String} content  The content to send
     * @param  {Object} code     (Optional) The http code to send
     * @param  {Object} type     Type of data to return (json?)
     * @return {null}
     */
    send: function( content, code, type ) {
        var toCall = type || this.resFunc;
        if (code) {
            this.res[ toCall ]( code, content );
        } else {
            this.res[ toCall ]( content );
        }
    },

    /**
     * Helpful function to use with express templates
     * 
     * @param  {String} template  The name of the template you want to render
     * @param  {Object} data      The data to pass into the template
     * @return {null}
     */
    render: function( template, data ) {
        this.res.render( template, data );
    },

    /**
     * Helpful function to use to handle and send exception errors
     * 
     * @param  {Mixed} exception  The exception
     * @return {null}
     */
    handleException: function(exception) {
        this.send({ error: 'Unhandled exception: ' + exception, stack: exception.stack }, 500);
    },

    /**
     * Helpful function to use to handle and send "Graceful" exception errors (sends 200 with JSON)
     * 
     * @param  {Mixed} exception  The exception
     * @return {null}
     */
    handleGracefulException: function(exception) {
        this.send( { status: 500, error: exception + (exception && exception.stack ? exception.stack : ' - No stack trace.') } );
    },

    /**
     * Handy helper function to work out of the current request http method is "GET"
     * @return {Boolean}
     */
    isGet: function() {
        return this.req.method.toLowerCase() == 'get';
    },

    /**
     * Handy helper function to work out of the current request http method is "POST"
     * @return {Boolean}
     */
    isPost: function() {
        return this.req.method.toLowerCase() == 'post';
    },

    /**
     * Handy helper function to work out of the current request http method is "PUT"
     * @return {Boolean}
     */
    isPut: function() {
        return this.req.method.toLowerCase() == 'put';
    }
});