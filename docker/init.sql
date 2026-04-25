-- MOKILager Database Initialization
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

USE mokilager;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role ENUM('admin', 'verwalter', 'leihender') NOT NULL DEFAULT 'leihender',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Articles (items in inventory)
CREATE TABLE IF NOT EXISTS articles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  article_number VARCHAR(100) UNIQUE,
  qr_code VARCHAR(255) UNIQUE,
  category_id INT,
  type ENUM('leihgeraet', 'verbrauchsmaterial') NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  min_quantity INT NOT NULL DEFAULT 0,
  unit VARCHAR(50) DEFAULT 'Stück',
  loan_duration_days INT DEFAULT NULL COMMENT 'For leihgeraet: max loan duration in days',
  location VARCHAR(255),
  image_url VARCHAR(500),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Transactions (loans and withdrawals)
CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  article_id INT NOT NULL,
  user_id INT NOT NULL,
  type ENUM('entnahme', 'leihe', 'rueckgabe', 'einlagerung', 'inventur') NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  quantity_before INT NOT NULL,
  quantity_after INT NOT NULL,
  notes TEXT,
  due_date DATE DEFAULT NULL COMMENT 'For loans: expected return date',
  returned_at TIMESTAMP NULL DEFAULT NULL,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Inventory sessions
CREATE TABLE IF NOT EXISTS inventory_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Inventory items (what was counted during inventory)
CREATE TABLE IF NOT EXISTS inventory_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  article_id INT NOT NULL,
  counted_quantity INT NOT NULL,
  system_quantity INT NOT NULL,
  delta INT NOT NULL,
  notes TEXT,
  FOREIGN KEY (session_id) REFERENCES inventory_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Active loans view helper
CREATE TABLE IF NOT EXISTS active_loans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT NOT NULL UNIQUE,
  article_id INT NOT NULL,
  user_id INT NOT NULL,
  quantity INT NOT NULL,
  loan_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  due_date DATE NOT NULL,
  reminder_sent BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default categories
INSERT INTO categories (name, description) VALUES
  ('Medizingeräte', 'Elektronische und mechanische Medizingeräte'),
  ('Verbandsmaterial', 'Verbände, Pflaster, Kompressen'),
  ('Instrumente', 'Medizinische Instrumente und Werkzeuge'),
  ('Schutzausrüstung', 'Handschuhe, Masken, Schutzkleidung'),
  ('Sonstiges', 'Sonstige Materialien');

-- Seed admin user (password: admin - bcrypt hash)
INSERT INTO users (username, email, password_hash, full_name, role) VALUES
  ('mokiadmin', 'admin@mokilager.at', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewFqNkzNomg.eR7i', 'MOKI Administrator', 'admin');

-- Sample articles
INSERT INTO articles (name, description, article_number, qr_code, category_id, type, quantity, min_quantity, unit, loan_duration_days, location) VALUES
  ('Blutdruckmessgerät', 'Digitales Oberarm-Blutdruckmessgerät', 'MG-001', 'QR-MG-001', 1, 'leihgeraet', 5, 1, 'Stück', 14, 'Regal A1'),
  ('Pulsoximeter', 'Finger-Pulsoximeter', 'MG-002', 'QR-MG-002', 1, 'leihgeraet', 8, 2, 'Stück', 7, 'Regal A1'),
  ('Fieberthermometer', 'Infrarot-Stirnthermometer', 'MG-003', 'QR-MG-003', 1, 'leihgeraet', 10, 2, 'Stück', 7, 'Regal A2'),
  ('Einmalhandschuhe L', 'Latex-freie Einmalhandschuhe Größe L', 'VM-001', 'QR-VM-001', 4, 'verbrauchsmaterial', 200, 50, 'Stück', NULL, 'Regal B1'),
  ('Wundverband 10x10', 'Steriler Wundverband 10x10cm', 'VM-002', 'QR-VM-002', 2, 'verbrauchsmaterial', 150, 30, 'Stück', NULL, 'Regal B2'),
  ('Desinfektionsmittel 500ml', 'Händedesinfektionsmittel 500ml', 'VM-003', 'QR-VM-003', 5, 'verbrauchsmaterial', 30, 10, 'Flasche', NULL, 'Regal C1');
