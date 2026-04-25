const express = require('express');
const { Op } = require('sequelize');
const { Transaction, Article, User, ActiveLoan, sequelize } = require('../models');
const { requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireRole('admin', 'verwalter'), async (req, res) => {
  try {
    // Recent transactions
    const recentTransactions = await Transaction.findAll({
      limit: 20,
      include: [
        { model: Article, as: 'article', attributes: ['id', 'name', 'type', 'unit'] },
        { model: User, as: 'user', attributes: ['id', 'full_name'] }
      ],
      order: [['created_at', 'DESC']]
    });

    // Articles below min stock
    const belowMin = await Article.findAll({
      where: {
        active: true,
        [Op.and]: sequelize.literal('quantity <= min_quantity')
      },
      attributes: ['id', 'name', 'type', 'quantity', 'min_quantity', 'unit', 'location']
    });

    // Overdue loans
    const today = new Date().toISOString().split('T')[0];
    const overdueLoans = await ActiveLoan.findAll({
      where: { due_date: { [Op.lt]: today } },
      include: [
        { model: Article, as: 'article', attributes: ['id', 'name'] },
        { model: User, as: 'user', attributes: ['id', 'full_name', 'email'] }
      ]
    });

    // Stats
    const totalArticles = await Article.count({ where: { active: true } });
    const totalLoans = await ActiveLoan.count();

    res.json({
      stats: { totalArticles, totalLoans, belowMinCount: belowMin.length, overdueCount: overdueLoans.length },
      recentTransactions,
      belowMin,
      overdueLoans
    });
  } catch (err) {
    console.error('[DASHBOARD]', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
