const express = require('express');
const { generateItinerary } = require('../controllers/itineraryController');
const { protect } = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/generate', protect, asyncHandler(generateItinerary));

module.exports = router;