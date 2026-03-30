const mongoose = require('mongoose');

const destinationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    image: { type: String, required: true },
    description: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    category: { type: String, trim: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Destination', destinationSchema);
