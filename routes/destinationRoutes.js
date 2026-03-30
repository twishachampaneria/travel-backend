const express = require('express');
const { getDestinations, searchDestinations } = require('../controllers/destinationController');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(getDestinations));
router.get('/search', asyncHandler(searchDestinations));

module.exports = router;
