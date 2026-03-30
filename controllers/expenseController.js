const Expense = require('../models/Expense');
const Trip = require('../models/Trip');

const addExpense = async (req, res) => {
  const { tripId, title, amount, category, date } = req.body;

  if (!tripId || !title || amount === undefined || !category || !date) {
    res.status(400);
    throw new Error('tripId, title, amount, category and date are required');
  }

  const trip = await Trip.findOne({ _id: tripId, user: req.user._id });
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found for this user');
  }

  const expensePayload = {
    title: String(title).trim(),
    amount: Number(amount),
    category: String(category).trim(),
    date: new Date(date)
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expensePayload.date.setHours(0, 0, 0, 0);

  if (
    !expensePayload.title ||
    !expensePayload.category ||
    !Number.isFinite(expensePayload.amount) ||
    expensePayload.amount < 0 ||
    Number.isNaN(expensePayload.date.getTime())
  ) {
    res.status(400);
    throw new Error('Invalid expense payload');
  }

  if (expensePayload.date < today) {
    res.status(400);
    throw new Error('Past dates are not allowed');
  }

  const expense = await Expense.create({
    user: req.user._id,
    trip: tripId,
    ...expensePayload
  });

  trip.expenses = Array.isArray(trip.expenses) ? trip.expenses : [];
  trip.expenses.push(expensePayload);
  await trip.save();

  res.status(201).json(expense);
};

const getExpensesByTrip = async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.tripId, user: req.user._id });
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }

  const expenses = await Expense.find({ trip: req.params.tripId, user: req.user._id }).sort({ date: -1 });
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);

  res.json({ expenses, total });
};

module.exports = { addExpense, getExpensesByTrip };


