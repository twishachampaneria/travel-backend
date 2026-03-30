require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Destination = require('../models/Destination');
const seedData = require('../data/destinations.seed.json');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await Destination.deleteMany({});
    await Destination.insertMany(seedData);
    console.log(`Seeded ${seedData.length} destinations.`);
  } catch (err) {
    console.error('Reseed failed:', err);
  } finally {
    await mongoose.disconnect();
  }
})();
