const express = require('express');
const {
  createTrip,
  getTrips,
  getTripById,
  getPublicTripById,
  updateTrip,
  deleteTrip
} = require('../controllers/tripController');
const { protect } = require('../middleware/authMiddleware');
const { requireEditor } = require('../middleware/roleMiddleware');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.get('/public/:id', asyncHandler(getPublicTripById));

router.use(protect);

router.route('/').get(asyncHandler(getTrips)).post(requireEditor, asyncHandler(createTrip));
router
  .route('/:id')
  .get(asyncHandler(getTripById))
  .put(requireEditor, asyncHandler(updateTrip))
  .delete(requireEditor, asyncHandler(deleteTrip));

module.exports = router;
