var inlinePreventedFunction = require('./util/inlinePreventedFunction');

class ES6Class {
  constructor(instanceString) {
    this.instanceString = instanceString;
  }
}

ES6Class.prototype.counter        = 0;
ES6Class.prototype.instanceArray  = [];
ES6Class.prototype.instanceString = '';
ES6Class.prototype.method         = inlinePreventedFunction;
ES6Class.prototype.parentMethod   = inlinePreventedFunction;



class ClassA extends ES6Class {
  constructor(instanceString) {
    super(instanceString);
  }
  method() {
    this.memberA =- this.memberA;
    super.method(false);
  }
}
ClassA.prototype.ownMethod = inlinePreventedFunction;
ClassA.prototype.memberA   = 1;
module.exports.ClassA      = ClassA;




class ClassB extends ES6Class {
  constructor(instanceString) {
    super(instanceString);
  }
  method() {
    this.memberB =- this.memberB;
    super.method(false);
  }
}
ClassB.prototype.ownMethod = inlinePreventedFunction;
ClassB.prototype.memberB   = 1;
module.exports.ClassB      = ClassB;
