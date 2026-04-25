const express = require('express');
const { InventorySession, InventoryItem, Article, Transaction, sequelize } = require('../models');
const { requireRole } = require('../middleware/auth');
const router = express.Router();

// Start new inventory session
router.post('/start', requireRole('admin', 'verwalter'), async (req, res) => {
  try {
    const session = await InventorySession.create({
      user_id: req.session.userId,
      notes: req.body.notes
    });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Add item count to session
router.post('/:sessionId/count', requireRole('admin', 'verwalter'), async (req, res) => {
  try {
    const session = await InventorySession.findByPk(req.params.sessionId);
    if (!session || session.completed_at) {
      return res.status(400).json({ error: 'Inventur nicht gefunden oder bereits abgeschlossen' });
    }
    const { article_id, counted_quantity, notes } = req.body;
    const article = await Article.findByPk(article_id);
    if (!article) return res.status(404).json({ error: 'Artikel nicht gefunden' });

    // Remove existing entry for this article in this session
    await InventoryItem.destroy({ where: { session_id: session.id, article_id } });

    const item = await InventoryItem.create({
      session_id: session.id,
      article_id,
      counted_quantity,
      system_quantity: article.quantity,
      delta: counted_quantity - article.quantity,
      notes
    });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Complete inventory session and apply corrections
router.post('/:sessionId/complete', requireRole('admin', 'verwalter'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const session = await InventorySession.findByPk(req.params.sessionId, {
      include: [{ model: InventoryItem, as: undefined }]
    });
    if (!session || session.completed_at) {
      await t.rollback();
      return res.status(400).json({ error: 'Inventur nicht gefunden oder bereits abgeschlossen' });
    }

    const items = await InventoryItem.findAll({ where: { session_id: session.id } });

    for (const item of items) {
      if (item.delta !== 0) {
        const article = await Article.findByPk(item.article_id, { transaction: t, lock: true });
        const qBefore = article.quantity;
        article.quantity = item.counted_quantity;
        await article.save({ transaction: t });
        await Transaction.create({
          article_id: item.article_id,
          user_id: req.session.userId,
          type: 'inventur',
          quantity: Math.abs(item.delta),
          quantity_before: qBefore,
          quantity_after: item.counted_quantity,
          notes: `Inventurkorrektur (Session #${session.id})`
        }, { transaction: t });
      }
    }

    session.completed_at = new Date();
    session.notes = req.body.notes || session.notes;
    await session.save({ transaction: t });

    await t.commit();
    res.json({ success: true, session_id: session.id });
  } catch (err) {
    await t.rollback();
    console.error('[INVENTORY] complete error:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Get inventory sessions
router.get('/sessions', requireRole('admin', 'verwalter'), async (req, res) => {
  try {
    const sessions = await InventorySession.findAll({
      order: [['started_at', 'DESC']],
      limit: 20
    });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Get session details
router.get('/sessions/:id', requireRole('admin', 'verwalter'), async (req, res) => {
  try {
    const session = await InventorySession.findByPk(req.params.id);
    if (!session) return res.status(404).json({ error: 'Nicht gefunden' });
    const items = await InventoryItem.findAll({
      where: { session_id: session.id },
      include: [{ model: Article, as: 'article', attributes: ['id', 'name', 'unit', 'type'] }]
    });
    res.json({ session, items });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
