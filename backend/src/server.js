require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const cron = require('node-cron');

const { sequelize } = require('./models');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const articleRoutes = require('./routes/articles');
const transactionRoutes = require('./routes/transactions');
const inventoryRoutes = require('./routes/inventory');
const dashboardRoutes = require('./routes/dashboard');
const { checkOverdueLoans } = require('./services/loanReminder');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'mokilager_secret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  }
}));

// Static files - frontend
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Cron: Check overdue loans daily at 8:00
cron.schedule('0 8 * * *', () => {
  console.log('[CRON] Checking overdue loans...');
  checkOverdueLoans();
});

// DB connect and start
sequelize.authenticate()
  .then(() => {
    console.log('[DB] Connected to MariaDB');
    return sequelize.sync({ alter: false });
  })
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[SERVER] MOKILager running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('[DB] Connection failed:', err);
    process.exit(1);
  });

module.exports = app;
