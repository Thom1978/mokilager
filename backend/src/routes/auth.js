const express = require('express');
const bcrypt = require('bcrypt');
const { User } = require('../models');
const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
    }

    const user = await User.findOne({ where: { username, active: true } });
    if (!user) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.fullName = user.full_name;

    res.json({
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// Get current session
router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Nicht angemeldet' });
  res.json({
    id: req.session.userId,
    username: req.session.username,
    full_name: req.session.fullName,
    role: req.session.role
  });
});

// Change own password
router.post('/change-password', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Nicht angemeldet' });
  try {
    const { current_password, new_password } = req.body;
    const user = await User.findByPk(req.session.userId);
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Aktuelles Passwort falsch' });
    if (new_password.length < 6) return res.status(400).json({ error: 'Passwort mindestens 6 Zeichen' });
    user.password_hash = await bcrypt.hash(new_password, 12);
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
