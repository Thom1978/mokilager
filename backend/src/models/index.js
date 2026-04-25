const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'mokilager',
  process.env.DB_USER || 'mokilager',
  process.env.DB_PASSWORD || 'mokilager_secret',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mariadb',
    logging: process.env.NODE_ENV !== 'production' ? console.log : false,
    dialectOptions: {
      timezone: 'Europe/Vienna',
    },
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 }
  }
);

// Models
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  full_name: { type: DataTypes.STRING(255), allowNull: false },
  role: { type: DataTypes.ENUM('admin', 'verwalter', 'leihender'), defaultValue: 'leihender' },
  active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'users', underscored: true });

const Category = sequelize.define('Category', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  description: DataTypes.TEXT
}, { tableName: 'categories', underscored: true });

const Article = sequelize.define('Article', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  description: DataTypes.TEXT,
  article_number: { type: DataTypes.STRING(100), unique: true },
  qr_code: { type: DataTypes.STRING(255), unique: true },
  category_id: DataTypes.INTEGER,
  type: { type: DataTypes.ENUM('leihgeraet', 'verbrauchsmaterial'), allowNull: false },
  quantity: { type: DataTypes.INTEGER, defaultValue: 0 },
  min_quantity: { type: DataTypes.INTEGER, defaultValue: 0 },
  unit: { type: DataTypes.STRING(50), defaultValue: 'Stück' },
  loan_duration_days: DataTypes.INTEGER,
  location: DataTypes.STRING(255),
  image_url: DataTypes.STRING(500),
  active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'articles', underscored: true });

const Transaction = sequelize.define('Transaction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  article_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  type: { type: DataTypes.ENUM('entnahme', 'leihe', 'rueckgabe', 'einlagerung', 'inventur'), allowNull: false },
  quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
  quantity_before: { type: DataTypes.INTEGER, allowNull: false },
  quantity_after: { type: DataTypes.INTEGER, allowNull: false },
  notes: DataTypes.TEXT,
  due_date: DataTypes.DATEONLY,
  returned_at: DataTypes.DATE,
  reminder_sent: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: 'transactions', underscored: true });

const ActiveLoan = sequelize.define('ActiveLoan', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  transaction_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  article_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  loan_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  due_date: { type: DataTypes.DATEONLY, allowNull: false },
  reminder_sent: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: 'active_loans', underscored: true });

const InventorySession = sequelize.define('InventorySession', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  started_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  completed_at: DataTypes.DATE,
  notes: DataTypes.TEXT
}, { tableName: 'inventory_sessions', underscored: true });

const InventoryItem = sequelize.define('InventoryItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  session_id: { type: DataTypes.INTEGER, allowNull: false },
  article_id: { type: DataTypes.INTEGER, allowNull: false },
  counted_quantity: { type: DataTypes.INTEGER, allowNull: false },
  system_quantity: { type: DataTypes.INTEGER, allowNull: false },
  delta: { type: DataTypes.INTEGER, allowNull: false },
  notes: DataTypes.TEXT
}, { tableName: 'inventory_items', underscored: true });

// Associations
Article.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Transaction.belongsTo(Article, { foreignKey: 'article_id', as: 'article' });
Transaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
ActiveLoan.belongsTo(Article, { foreignKey: 'article_id', as: 'article' });
ActiveLoan.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
ActiveLoan.belongsTo(Transaction, { foreignKey: 'transaction_id', as: 'transaction' });
InventorySession.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
InventoryItem.belongsTo(Article, { foreignKey: 'article_id', as: 'article' });

module.exports = {
  sequelize,
  User, Category, Article, Transaction, ActiveLoan, InventorySession, InventoryItem
};
