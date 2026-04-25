const express = require('express');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { Article, Category } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

// List articles
router.get('/', requireAuth, async (req, res) => {
  try {
    const where = {};
    if (req.query.active !== 'all') where.active = true;
    if (req.query.type) where.type = req.query.type;
    const articles = await Article.findAll({
      where,
      include: [{ model: Category, as: 'category' }],
      order: [['name', 'ASC']]
    });
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Get single article or by QR code
router.get('/qr/:qrCode', requireAuth, async (req, res) => {
  try {
    const article = await Article.findOne({
      where: { qr_code: req.params.qrCode, active: true },
      include: [{ model: Category, as: 'category' }]
    });
    if (!article) return res.status(404).json({ error: 'Artikel nicht gefunden' });
    res.json(article);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const article = await Article.findByPk(req.params.id, {
      include: [{ model: Category, as: 'category' }]
    });
    if (!article) return res.status(404).json({ error: 'Artikel nicht gefunden' });
    res.json(article);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Create article (admin only)
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name, description, article_number, category_id, type, quantity, min_quantity, unit, loan_duration_days, location } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'Name und Typ erforderlich' });
    const qr_code = 'QR-' + uuidv4().toUpperCase().substring(0, 8);
    const article = await Article.create({
      name, description, article_number, qr_code, category_id,
      type, quantity: quantity || 0, min_quantity: min_quantity || 0,
      unit: unit || 'Stück', loan_duration_days: type === 'leihgeraet' ? loan_duration_days : null,
      location
    });
    res.json(article);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Artikelnummer bereits vergeben' });
    }
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Update article (admin only)
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const article = await Article.findByPk(req.params.id);
    if (!article) return res.status(404).json({ error: 'Artikel nicht gefunden' });
    const fields = ['name', 'description', 'article_number', 'category_id', 'type', 'min_quantity', 'unit', 'loan_duration_days', 'location', 'active'];
    fields.forEach(f => { if (req.body[f] !== undefined) article[f] = req.body[f]; });
    await article.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Delete article (admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await Article.update({ active: false }, { where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Generate QR code image
router.get('/:id/qrcode', requireAuth, async (req, res) => {
  try {
    const article = await Article.findByPk(req.params.id);
    if (!article) return res.status(404).json({ error: 'Artikel nicht gefunden' });
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const qrData = `${appUrl}/scan?qr=${article.qr_code}`;
    const qrDataUrl = await QRCode.toDataURL(qrData, { width: 300, margin: 2 });
    res.json({ qr_code: article.qr_code, qr_image: qrDataUrl, scan_url: qrData });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Get categories
router.get('/meta/categories', requireAuth, async (req, res) => {
  try {
    const categories = await Category.findAll({ order: [['name', 'ASC']] });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
