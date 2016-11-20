const mongoose = require('mongoose');

const expeditionSchema = {
  xml: String
};

const Expedition = mongoose.model('Expedition', expeditionSchema);

module.exports = Expedition;
