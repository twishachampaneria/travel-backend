const express = require('express');
const { addExpense, getExpensesByTrip } = require('../controllers/expenseController');
const { protect } = require('../middleware/authMiddleware');
const { requireEditor } = require('../middleware/roleMiddleware');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.use(protect);

router.post('/', requireEditor, asyncHandler(addExpense));
router.get('/trip/:tripId', asyncHandler(getExpensesByTrip));

module.exports = router;
