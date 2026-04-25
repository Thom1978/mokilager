const express = require('express');
const { Op } = require('sequelize');
const { Transaction, Article, User, ActiveLoan, sequelize } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

// List transactions
router.get('/', requireRole('admin', 'verwalter'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const where = {};
    if (req.query.type) where.type = req.query.type;
    if (req.query.article_id) where.article_id = req.query.article_id;
    const rows = await Transaction.findAndCountAll({
      where, limit, offset,
      include: [
        { model: Article, as: 'article', attributes: ['id', 'name', 'type', 'unit'] },
        { model: User, as: 'user', attributes: ['id', 'full_name', 'username'] }
      ],
      order: [['created_at', 'DESC']]
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Withdraw / borrow article
router.post('/scan', requireAuth, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { qr_code, quantity = 1, notes } = req.body;
    if (!qr_code) return res.status(400).json({ error: 'QR-Code erforderlich' });

    const article = await Article.findOne({ where: { qr_code, active: true }, transaction: t, lock: true });
    if (!article) {
      await t.rollback();
      return res.status(404).json({ error: 'Artikel nicht gefunden' });
    }

    if (article.quantity < quantity) {
      await t.rollback();
      return res.status(400).json({ error: `Nicht genug Bestand. Verfügbar: ${article.quantity} ${article.unit}` });
    }

    const transType = article.type === 'leihgeraet' ? 'leihe' : 'entnahme';
    const quantityBefore = article.quantity;
    const quantityAfter = article.quantity - quantity;

    article.quantity = quantityAfter;
    await article.save({ transaction: t });

    let dueDate = null;
    if (article.type === 'leihgeraet' && article.loan_duration_days) {
      const due = new Date();
      due.setDate(due.getDate() + article.loan_duration_days);
      dueDate = due.toISOString().split('T')[0];
    }

    const txn = await Transaction.create({
      article_id: article.id,
      user_id: req.session.userId,
      type: transType,
      quantity,
      quantity_before: quantityBefore,
      quantity_after: quantityAfter,
      notes,
      due_date: dueDate
    }, { transaction: t });

    if (transType === 'leihe' && dueDate) {
      await ActiveLoan.create({
        transaction_id: txn.id,
        article_id: article.id,
        user_id: req.session.userId,
        quantity,
        due_date: dueDate
      }, { transaction: t });
    }

    await t.commit();
    res.json({
      success: true,
      transaction: txn,
      article: { id: article.id, name: article.name, type: article.type },
      due_date: dueDate,
      message: transType === 'leihe'
        ? `Gerät ausgeliehen. Rückgabe bis: ${dueDate}`
        : `${quantity} ${article.unit} entnommen.`
    });
  } catch (err) {
    await t.rollback();
    console.error('[TRANSACTION] scan error:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Return loaned item
router.post('/return', requireAuth, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { qr_code, quantity = 1, notes } = req.body;
    const article = await Article.findOne({ where: { qr_code, active: true }, transaction: t, lock: true });
    if (!article) {
      await t.rollback();
      return res.status(404).json({ error: 'Artikel nicht gefunden' });
    }

    if (article.type !== 'leihgeraet') {
      await t.rollback();
      return res.status(400).json({ error: 'Verbrauchsmaterial kann nicht zurückgegeben werden' });
    }

    // Find active loan for this user and article
    const loan = await ActiveLoan.findOne({
      where: {
        article_id: article.id,
        user_id: req.session.userId
      },
      transaction: t
    });

    const quantityBefore = article.quantity;
    const quantityAfter = article.quantity + (loan ? loan.quantity : quantity);
    article.quantity = quantityAfter;
    await article.save({ transaction: t });

    await Transaction.create({
      article_id: article.id,
      user_id: req.session.userId,
      type: 'rueckgabe',
      quantity: loan ? loan.quantity : quantity,
      quantity_before: quantityBefore,
      quantity_after: quantityAfter,
      notes,
      returned_at: new Date()
    }, { transaction: t });

    if (loan) {
      await loan.destroy({ transaction: t });
    }

    await t.commit();
    res.json({ success: true, message: 'Gerät erfolgreich zurückgegeben.' });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Stock in (verwalter/admin)
router.post('/stock', requireRole('admin', 'verwalter'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { article_id, quantity, notes } = req.body;
    if (!article_id || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Artikel und Menge erforderlich' });
    }
    const article = await Article.findByPk(article_id, { transaction: t, lock: true });
    if (!article) {
      await t.rollback();
      return res.status(404).json({ error: 'Artikel nicht gefunden' });
    }
    const quantityBefore = article.quantity;
    article.quantity += parseInt(quantity);
    await article.save({ transaction: t });
    await Transaction.create({
      article_id, user_id: req.session.userId,
      type: 'einlagerung', quantity,
      quantity_before: quantityBefore,
      quantity_after: article.quantity, notes
    }, { transaction: t });
    await t.commit();
    res.json({ success: true, new_quantity: article.quantity });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Active loans
router.get('/active-loans', requireRole('admin', 'verwalter'), async (req, res) => {
  try {
    const loans = await ActiveLoan.findAll({
      include: [
        { model: Article, as: 'article', attributes: ['id', 'name', 'unit'] },
        { model: User, as: 'user', attributes: ['id', 'full_name', 'username', 'email'] }
      ],
      order: [['due_date', 'ASC']]
    });
    const today = new Date().toISOString().split('T')[0];
    const result = loans.map(l => ({
      ...l.toJSON(),
      overdue: l.due_date < today
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// My active loans (for leihender)
router.get('/my-loans', requireAuth, async (req, res) => {
  try {
    const loans = await ActiveLoan.findAll({
      where: { user_id: req.session.userId },
      include: [{ model: Article, as: 'article', attributes: ['id', 'name', 'type', 'unit', 'qr_code'] }],
      order: [['due_date', 'ASC']]
    });
    const today = new Date().toISOString().split('T')[0];
    res.json(loans.map(l => ({ ...l.toJSON(), overdue: l.due_date < today })));
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
