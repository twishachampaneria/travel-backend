const express = require('express');
const { register, login, me, updateMe, verifySecret, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.post('/verify-secret', asyncHandler(verifySecret));
router.post('/reset-password', asyncHandler(resetPassword));
router.get('/me', protect, asyncHandler(me));
router.put('/me', protect, asyncHandler(updateMe));

module.exports = router;

