const mongoose = require('mongoose');

const tripDestinationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    image: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    day: { type: Number, required: true, min: 1 },
    activities: [{ type: String, trim: true }]
  },
  { _id: false }
);

const tripDaySchema = new mongoose.Schema(
  {
    day: { type: Number, required: true, min: 1 },
    destinations: { type: [tripDestinationSchema], default: [] },
    photos: { type: [String], default: [] }
  },
  { _id: false }
);

const tripExpenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true },
    date: { type: Date, required: true }
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    budget: { type: Number, required: true, min: 0 },
    days: { type: [tripDaySchema], default: [] },
    destinations: { type: [tripDestinationSchema], default: [] },
    expenses: { type: [tripExpenseSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Trip', tripSchema);
