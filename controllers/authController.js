const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });

const register = async (req, res) => {
  const { name, email, password, secretCode } = req.body;

  if (!name || !email || !password || !secretCode) {
    res.status(400);
    throw new Error('Name, email, password, and secret code are required');
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    res.status(409);
    throw new Error('Email already registered');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const hashedSecretCode = await bcrypt.hash(secretCode, salt);

  const user = await User.create({ name, email, password: hashedPassword, secretCode: hashedSecretCode });

  res.status(201).json({
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    token: generateToken(user._id)
  });
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Email and password are required');
  }

  const user = await User.findOne({ email });
  if (!user) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  res.json({
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    token: generateToken(user._id)
  });
};


const verifySecret = async (req, res) => {
  const { email, secretCode } = req.body;

  if (!email || !secretCode) {
    res.status(400);
    throw new Error('Email and secret code are required');
  }

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user || !user.secretCode) {
    res.status(401);
    throw new Error('Invalid email or secret code');
  }

  const match = await bcrypt.compare(secretCode, user.secretCode);
  if (!match) {
    res.status(401);
    throw new Error('Invalid email or secret code');
  }

  user.secretVerifiedUntil = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  res.json({ message: 'Secret verified' });
};

const resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    res.status(400);
    throw new Error('Email and new password are required');
  }

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (!user.secretVerifiedUntil || user.secretVerifiedUntil < new Date()) {
    res.status(403);
    throw new Error('Secret verification required');
  }

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  user.secretVerifiedUntil = null;
  await user.save();

  res.json({ message: 'Password updated successfully' });
};
const me = async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    }
  });
};

const updateMe = async (req, res) => {
  const { name, email } = req.body;

  const nextName = String(name || '').trim();
  const nextEmail = String(email || '').trim().toLowerCase();

  if (!nextName || !nextEmail) {
    res.status(400);
    throw new Error('Name and email are required');
  }

  const existingUser = await User.findOne({ email: nextEmail, _id: { $ne: req.user._id } });
  if (existingUser) {
    res.status(409);
    throw new Error('Email already in use');
  }

  req.user.name = nextName;
  req.user.email = nextEmail;
  await req.user.save();

  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    }
  });
};

module.exports = { register, login, me, updateMe, verifySecret, resetPassword };

