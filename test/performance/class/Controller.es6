import { EventEmitter } from 'events';

class Class extends EventEmitter {
  constructor() {
    super();
    this.emit('init', this);
  }
}

class Model extends Class {
  constructor() {
    super();
    Object.keys(this.fields).forEach(function(field) {
      console.dir(field);
    });
  }

  save() {
    console.log('save model');
  }

  destroy() {
    console.log('destroy model');
  }

  toObject() {
    return JSON.parse(this.toJSON());
  }

  toJSON() {
    return JSON.stringify(this);
  }

  inspect() {
    return this.toObject();
  }
}

class ExampleModel extends Model {
  static driver = 'ORM';
  static timeStampable = true;
  static fields = {
    id: {
      type          : Number,
      primaryKey    : true,
      autoIncrement : true
    },
    name: {
      type          : String,
      allowNull     : false,
      required      : true
    }
  }
}

// console.log('ExampleModel:');
// console.dir(ExampleModel);
// console.log('\n\n New ExampleModel');
// console.dir(new ExampleModel());
