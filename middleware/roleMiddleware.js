const requireEditor = (req, res, next) => {
  if (req.user?.role && req.user.role !== 'editor') {
    res.status(403);
    throw new Error('Editor access required');
  }
  next();
};

module.exports = { requireEditor };
