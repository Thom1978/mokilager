const express = require('express');
const bcrypt = require('bcrypt');
const { User } = require('../models');
const { requireRole } = require('../middleware/auth');
const router = express.Router();

// List all users (admin only)
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'full_name', 'role', 'active', 'created_at'],
      order: [['full_name', 'ASC']]
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Create user (admin only)
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { username, email, full_name, role, password } = req.body;
    if (!username || !email || !full_name || !role || !password) {
      return res.status(400).json({ error: 'Alle Felder erforderlich' });
    }
    if (password.length < 6) return res.status(400).json({ error: 'Passwort mindestens 6 Zeichen' });
    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email, full_name, role, password_hash: hash });
    res.json({ id: user.id, username: user.username, full_name: user.full_name, role: user.role });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Benutzername oder E-Mail bereits vergeben' });
    }
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Update user (admin only)
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    const { email, full_name, role, active, password } = req.body;
    if (email) user.email = email;
    if (full_name) user.full_name = full_name;
    if (role) user.role = role;
    if (active !== undefined) user.active = active;
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Passwort mindestens 6 Zeichen' });
      user.password_hash = await bcrypt.hash(password, 12);
    }
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Delete user (admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.session.userId) {
      return res.status(400).json({ error: 'Eigenen Account kann man nicht löschen' });
    }
    await User.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
