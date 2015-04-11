var EventEmitter = require('events').EventEmitter
  , util         = require('util');

class ES6Class extends EventEmitter {
    constructor(req, res, next) {
        this.req  = req;
        this.res  = res;
        this.next = next;

        super();
        EventEmitter.call(this);
        this.setMaxListeners(0);
    }
    emit(name, event) {
        super.emit(name, event);
    }
    static defaultMatrix() {
        return new THREE.Matrix4();
    }
}

module.exports = ES6Class;


// console.log(util.inspect(ES6Class, {level:4}));
var instance = new ES6Class('bar');
instance.on('fuck', function() {
  console.dir('FUCK');
});



setInterval(function() {
  console.log(instance)
  instance.emit('FUCK', { message: 'wow' });
}, 1000);
