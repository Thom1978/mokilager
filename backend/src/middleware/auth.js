const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Nicht angemeldet' });
  }
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Nicht angemeldet' });
  }
  if (!roles.includes(req.session.role)) {
    return res.status(403).json({ error: 'Keine Berechtigung' });
  }
  next();
};

module.exports = { requireAuth, requireRole };
