const mongoose = require('mongoose');

const personSchema = {
  xml: String
};

const Person = mongoose.model('Person', personSchema);

module.exports = Person;
