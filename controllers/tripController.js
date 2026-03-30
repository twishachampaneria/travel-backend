const Trip = require('../models/Trip');
const Expense = require('../models/Expense');

const getStartOfDay = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

const validateDates = (startDate, endDate, enforceFuture = true) => {
  const start = getStartOfDay(startDate);
  const end = getStartOfDay(endDate);
  const today = getStartOfDay(new Date());

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid startDate or endDate');
  }

  if (enforceFuture && (start < today || end < today)) {
    throw new Error('Past dates are not allowed');
  }

  if (end < start) {
    throw new Error('endDate must be greater than or equal to startDate');
  }
};

const normalizeActivities = (activities) =>
  Array.isArray(activities)
    ? activities.map((activity) => String(activity).trim()).filter(Boolean)
    : [];

const normalizePhotos = (photos) =>
  Array.isArray(photos) ? photos.map((photo) => String(photo).trim()).filter(Boolean) : [];

const normalizeDestination = (destination = {}, fallbackDay = 1) => {
  const name = String(destination.name || '').trim();
  const country = String(destination.country || '').trim();
  const day = Number(destination.day || fallbackDay || 1);
  const image =
    String(destination.image || '').trim() ||
    `https://picsum.photos/seed/${encodeURIComponent(name || country || 'trip')}/800/600`;
  const description =
    String(destination.description || '').trim() ||
    `Planned stop in ${name || country || 'your destination'} with day-wise activities.`;

  return {
    name,
    country,
    image,
    description,
    lat: Number(destination.lat),
    lng: Number(destination.lng),
    day,
    activities: normalizeActivities(destination.activities)
  };
};

const validateDestination = (destination) => {
  if (
    !destination.name ||
    !destination.country ||
    !destination.image ||
    !destination.description ||
    !Number.isFinite(destination.lat) ||
    !Number.isFinite(destination.lng) ||
    !Number.isInteger(destination.day) ||
    destination.day < 1
  ) {
    throw new Error(
      'Each destination must include name, country, image, description, coordinates, and valid day'
    );
  }
};

const buildDaysFromDestinations = (destinations = []) => {
  const map = new Map();

  destinations.forEach((destination) => {
    const day = Number(destination.day || 1);
    if (!map.has(day)) map.set(day, []);
    map.get(day).push({ ...destination, day });
  });

  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([day, items]) => ({ day, destinations: items, photos: [] }));
};

const normalizeDays = (days = []) => {
  if (!Array.isArray(days)) {
    throw new Error('days must be an array');
  }

  const grouped = new Map();

  days.forEach((dayItem, index) => {
    const day = Number(dayItem?.day ?? index + 1);
    if (!Number.isInteger(day) || day < 1) {
      throw new Error('Each day must include a valid day number');
    }

    const normalizedDestinations = Array.isArray(dayItem?.destinations)
      ? dayItem.destinations.map((destination) => {
          const normalized = normalizeDestination(destination, day);
          validateDestination(normalized);
          return { ...normalized, day };
        })
      : [];

    const normalizedPhotos = normalizePhotos(dayItem?.photos);

    if (!grouped.has(day)) grouped.set(day, { destinations: [], photos: [] });
    const entry = grouped.get(day);
    entry.destinations.push(...normalizedDestinations);
    entry.photos.push(...normalizedPhotos);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([day, entry]) => ({ day, destinations: entry.destinations, photos: entry.photos }));
};

const normalizeDestinations = (destinations = []) => {
  if (!Array.isArray(destinations)) {
    throw new Error('destinations must be an array');
  }

  return destinations.map((destination) => {
    const normalized = normalizeDestination(destination, destination.day || 1);
    validateDestination(normalized);
    return normalized;
  });
};

const normalizeTimelineInput = ({ days, destinations }) => {
  if (Array.isArray(days)) {
    const normalizedDays = normalizeDays(days);
    const flattened = normalizedDays.flatMap((dayItem) => dayItem.destinations);
    return { days: normalizedDays, destinations: flattened };
  }

  if (Array.isArray(destinations)) {
    const normalizedDestinations = normalizeDestinations(destinations);
    return {
      destinations: normalizedDestinations,
      days: buildDaysFromDestinations(normalizedDestinations)
    };
  }

  return { days: [], destinations: [] };
};

const normalizeExpense = (expense = {}) => {
  const title = String(expense.title || '').trim();
  const category = String(expense.category || '').trim();
  const amount = Number(expense.amount);
  const date = new Date(expense.date);

  if (!title || !category || !Number.isFinite(amount) || amount < 0 || Number.isNaN(date.getTime())) {
    throw new Error('Invalid expense payload in trip update');
  }

  return {
    title,
    category,
    amount,
    date
  };
};

const attachLegacyExpensesIfNeeded = async (trip, userId) => {
  if (Array.isArray(trip.expenses) && trip.expenses.length) {
    return trip.expenses;
  }

  const legacyExpenses = await Expense.find({ trip: trip._id, user: userId }).sort({ date: -1 });
  return legacyExpenses.map((expense) => ({
    title: expense.title,
    amount: expense.amount,
    category: expense.category,
    date: expense.date
  }));
};

const enrichTripResponse = async (trip, userId) => {
  const tripObject = trip.toObject();

  const days = Array.isArray(tripObject.days) && tripObject.days.length
    ? tripObject.days
    : buildDaysFromDestinations(tripObject.destinations || []);

  const destinations = days.flatMap((dayItem) =>
    (dayItem.destinations || []).map((destination) => ({ ...destination, day: dayItem.day }))
  );

  const expenses = await attachLegacyExpensesIfNeeded(trip, userId);
  const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    ...tripObject,
    days,
    destinations,
    expenses,
    totalExpenses
  };
};

const getPublicTripById = async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }

  const tripObject = trip.toObject();
  const days = Array.isArray(tripObject.days) && tripObject.days.length
    ? tripObject.days
    : buildDaysFromDestinations(tripObject.destinations || []);

  const destinations = days.flatMap((dayItem) =>
    (dayItem.destinations || []).map((destination) => ({ ...destination, day: dayItem.day }))
  );

  res.json({
    _id: tripObject._id,
    title: tripObject.title,
    startDate: tripObject.startDate,
    endDate: tripObject.endDate,
    budget: tripObject.budget,
    days,
    destinations
  });
};
const createTrip = async (req, res) => {
  const { title, startDate, endDate, days, destinations, budget, expenses } = req.body;

  if (!title || !startDate || !endDate || budget === undefined) {
    res.status(400);
    throw new Error('title, startDate, endDate and budget are required');
  }

  validateDates(startDate, endDate);
  const timeline = normalizeTimelineInput({ days, destinations });

  const trip = await Trip.create({
    user: req.user._id,
    title,
    startDate,
    endDate,
    budget,
    days: timeline.days,
    destinations: timeline.destinations,
    expenses: Array.isArray(expenses) ? expenses.map(normalizeExpense) : []
  });

  const response = await enrichTripResponse(trip, req.user._id);
  res.status(201).json(response);
};

const getTrips = async (req, res) => {
  const trips = await Trip.find({ user: req.user._id }).sort({ startDate: 1 });
  const formatted = await Promise.all(trips.map((trip) => enrichTripResponse(trip, req.user._id)));
  res.json(formatted);
};

const getTripById = async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, user: req.user._id });
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }

  const response = await enrichTripResponse(trip, req.user._id);
  res.json(response);
};

const updateTrip = async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, user: req.user._id });
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }

  const { title, startDate, endDate, days, destinations, budget, expenses } = req.body;

  const nextStart = startDate ?? trip.startDate;
  const nextEnd = endDate ?? trip.endDate;
  const existingStart = getStartOfDay(trip.startDate).getTime();
  const existingEnd = getStartOfDay(trip.endDate).getTime();
  const incomingStart = getStartOfDay(nextStart).getTime();
  const incomingEnd = getStartOfDay(nextEnd).getTime();
  const enforceFuture = incomingStart !== existingStart || incomingEnd !== existingEnd;
  validateDates(nextStart, nextEnd, enforceFuture);

  if (days !== undefined || destinations !== undefined) {
    const timeline = normalizeTimelineInput({
      days: days !== undefined ? days : trip.days,
      destinations: destinations !== undefined ? destinations : trip.destinations
    });

    trip.days = timeline.days;
    trip.destinations = timeline.destinations;
  }

  if (expenses !== undefined) {
    if (!Array.isArray(expenses)) {
      res.status(400);
      throw new Error('expenses must be an array');
    }

    trip.expenses = expenses.map(normalizeExpense);
  }

  trip.title = title ?? trip.title;
  trip.startDate = nextStart;
  trip.endDate = nextEnd;
  trip.budget = budget ?? trip.budget;

  const updatedTrip = await trip.save();
  const response = await enrichTripResponse(updatedTrip, req.user._id);
  res.json(response);
};

const deleteTrip = async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, user: req.user._id });
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }

  await Expense.deleteMany({ trip: trip._id, user: req.user._id });
  await trip.deleteOne();

  res.json({ message: 'Trip deleted' });
};

module.exports = { createTrip, getTrips, getTripById, getPublicTripById, updateTrip, deleteTrip };
