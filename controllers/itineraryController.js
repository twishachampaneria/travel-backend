const Destination = require('../models/Destination');

const destinationProfiles = {
  paris: {
    morning: [
      'Sunrise walk at Trocadero with Eiffel Tower views',
      'Guided Louvre highlights tour',
      'Coffee and pastry crawl in Le Marais',
      'Photo walk through Montmartre lanes'
    ],
    afternoon: [
      'Seine River cruise and riverside promenade',
      'Musee d Orsay impressionist collection visit',
      'Picnic at Luxembourg Gardens',
      'Explore Notre-Dame area and Latin Quarter'
    ],
    evening: [
      'Dinner at a classic bistro in Saint-Germain',
      'Eiffel Tower sparkle view from Champ de Mars',
      'Cabaret or jazz night near Pigalle',
      'Nighttime riverbank walk with crepe stop'
    ]
  },
  kyoto: {
    morning: [
      'Early Fushimi Inari shrine gates hike',
      'Zen meditation session at a local temple',
      'Arashiyama bamboo grove before crowds',
      'Traditional tea ceremony in Higashiyama'
    ],
    afternoon: [
      'Kinkaku-ji and Ryoan-ji temple circuit',
      'Nishiki Market street food tasting',
      'Philosophers Path and neighborhood cafes',
      'Kimono district walk in Gion and Yasaka'
    ],
    evening: [
      'Kaiseki dinner experience',
      'Lantern-lit stroll through Gion lanes',
      'Onsen wind-down session',
      'Riverside walk along Kamo River'
    ]
  },
  bali: {
    morning: [
      'Sunrise at Tegallalang rice terraces',
      'Morning yoga in Ubud',
      'Waterfall trail at Tegenungan',
      'Local breakfast and village market visit'
    ],
    afternoon: [
      'Ubud art village and craft workshops',
      'Beach relaxation in Seminyak',
      'Temple visit at Tirta Empul',
      'Balinese cooking class'
    ],
    evening: [
      'Sunset at Uluwatu cliffs',
      'Seafood dinner by Jimbaran Bay',
      'Traditional Kecak dance performance',
      'Beach club chill session'
    ]
  },
  default: {
    morning: [
      'Historic center walking tour',
      'Scenic viewpoint and cafe breakfast',
      'Local culture museum visit',
      'Neighborhood discovery walk'
    ],
    afternoon: [
      'Signature landmark exploration',
      'Regional lunch and food street sampling',
      'Shopping and artisan district visit',
      'City park leisure time'
    ],
    evening: [
      'Sunset viewpoint and photography stop',
      'Dinner at a highly-rated local spot',
      'Live music or cultural show',
      'Relaxed promenade walk'
    ]
  }
};

const budgetOverrides = {
  low: {
    morning: ['Free walking tour and public gardens', 'Local street breakfast and market stroll'],
    afternoon: ['Budget-friendly museum or city park', 'Self-guided neighborhood exploration'],
    evening: ['Local street food and sunset viewpoint', 'Riverside walk with affordable snacks']
  },
  high: {
    morning: ['Private guided experience with hotel pickup', 'Premium brunch at a top-rated spot'],
    afternoon: ['VIP attraction access or curated shopping', 'Private boat or heritage tour'],
    evening: ['Fine dining reservation', 'Luxury lounge or show experience']
  }
};

const slotLabelMap = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening'
};

const resolveProfile = (destinationName) => {
  const key = String(destinationName || '').trim().toLowerCase();
  return destinationProfiles[key] || destinationProfiles.default;
};

const resolveBudgetTier = (budget, days) => {
  const totalBudget = Number(budget || 0);
  const totalDays = Number(days || 0);
  if (!totalBudget || !totalDays) return 'mid';

  const daily = totalBudget / totalDays;
  if (daily < 2000) return 'low';
  if (daily > 8000) return 'high';
  return 'mid';
};

const selectActivity = (items, dayIndex, slotSeed) => {
  if (!items.length) return 'Explore local highlights';

  const index = (dayIndex * 2 + slotSeed) % items.length;
  return items[index];
};

const buildDayPlan = (profile, day, budgetTier, totalDays) => {
  const dayIndex = day - 1;
  const override = budgetTier === 'low' ? budgetOverrides.low : budgetTier === 'high' ? budgetOverrides.high : null;

  const morningPool = override?.morning?.length ? override.morning : profile.morning;
  const afternoonPool = override?.afternoon?.length ? override.afternoon : profile.afternoon;
  const eveningPool = override?.evening?.length ? override.evening : profile.evening;

  let morning = selectActivity(morningPool, dayIndex, 0);
  let afternoon = selectActivity(afternoonPool, dayIndex, 1);
  let evening = selectActivity(eveningPool, dayIndex, 2);

  if (totalDays >= 6 && day % 5 === 0) {
    morning = 'Slow morning with cafe time and journaling';
    afternoon = 'Flexible exploration or rest time';
    evening = 'Light dinner and neighborhood stroll';
  }

  return {
    day,
    activities: [
      `${slotLabelMap.morning}: ${morning}`,
      `${slotLabelMap.afternoon}: ${afternoon}`,
      `${slotLabelMap.evening}: ${evening}`
    ]
  };
};

const generateItinerary = async (req, res) => {
  const { destination, days, budget } = req.body;

  if (!destination || !days || Number(days) < 1) {
    res.status(400);
    throw new Error('destination and days (>=1) are required');
  }

  const totalDays = Number(days);
  const destinationDoc = await Destination.findOne({ name: new RegExp(`^${destination}$`, 'i') });
  const profile = resolveProfile(destination);
  const budgetTier = resolveBudgetTier(budget, totalDays);

  const itinerary = Array.from({ length: totalDays }, (_, index) =>
    buildDayPlan(profile, index + 1, budgetTier, totalDays)
  );

  res.json({
    destination,
    days: totalDays,
    budgetTier,
    coordinates: destinationDoc
      ? { lat: destinationDoc.lat, lng: destinationDoc.lng }
      : { lat: 0, lng: 0 },
    itinerary
  });
};

module.exports = { generateItinerary };
