function NoAction( message ) {
  Error.call( this );
  Error.captureStackTrace( this, this.constructor );

  this.name = this.constructor.name;
  this.message = message;
}

require( 'util' ).inherits( NoAction, Error );

module.exports = NoAction;
