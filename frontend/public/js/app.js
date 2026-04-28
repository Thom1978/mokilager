/* ========================================
   MOKILager – Main Application JS
   ======================================== */

let currentUser = null;
let qrScanner = null;
let qrScanMode = 'entnahme'; // or 'rueckgabe'
let currentArticle = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Check for QR scan URL param
  const urlParams = new URLSearchParams(window.location.search);
  const qrParam = urlParams.get('qr');

  checkSession().then(() => {
    if (currentUser && qrParam) {
      window.history.replaceState({}, '', '/');
      navigateTo('scan');
      setTimeout(() => handleQRResult(qrParam), 500);
    }
  });
});

async function checkSession() {
  try {
    const res = await api('/api/auth/me');
    if (res.ok) {
      currentUser = await res.json();
      showApp();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  setupSidebar();
  navigateTo(currentUser.role === 'leihender' ? 'scan' : 'dashboard');
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  try {
    const res = await api('/api/auth/login', { method: 'POST', body: { username, password } });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Anmeldung fehlgeschlagen';
      errEl.style.display = 'block';
      return;
    }
    currentUser = data;
    showApp();
  } catch {
    errEl.textContent = 'Verbindungsfehler';
    errEl.style.display = 'block';
  }
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  currentUser = null;
  showLogin();
}

// ===== API HELPER =====
async function api(url, opts = {}) {
  const options = {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...opts
  };
  if (opts.body && typeof opts.body === 'object') {
    options.body = JSON.stringify(opts.body);
  }
  return fetch(url, options);
}

// ===== SIDEBAR =====
function setupSidebar() {
  const role = currentUser.role;
  document.getElementById('sidebar-username').textContent = currentUser.full_name;
  document.getElementById('sidebar-email').textContent = currentUser.username;
  document.getElementById('sidebar-role').textContent = roleLabel(role);
  document.getElementById('topbar-user').textContent = currentUser.full_name;
  document.getElementById('sidebar-avatar').textContent = currentUser.full_name.charAt(0).toUpperCase();

  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';

  const items = [
    { roles: ['leihender', 'verwalter', 'admin'], icon: '📷', label: 'Scan / Ausleihe', page: 'scan' },
    { roles: ['admin', 'verwalter'], icon: '📊', label: 'Dashboard', page: 'dashboard' },
    { roles: ['admin', 'verwalter'], icon: '📋', label: 'Transaktionen', page: 'transactions' },
    { roles: ['admin', 'verwalter'], icon: '🔄', label: 'Aktive Leihen', page: 'active-loans' },
    { roles: ['verwalter', 'admin'], icon: '📦', label: 'Einlagern', page: 'stock-in' },
    { roles: ['verwalter', 'admin'], icon: '🗂️', label: 'Inventur', page: 'inventory' },
    { roles: ['admin', 'verwalter', 'leihender'], icon: '📱', label: 'Meine Leihen', page: 'my-loans' },
    { roles: ['admin'], icon: '📦', label: 'Artikel', page: 'articles' },
    { roles: ['admin'], icon: '👥', label: 'Benutzer', page: 'users' },
    { roles: ['admin', 'verwalter', 'leihender'], icon: '🔑', label: 'Passwort ändern', page: 'change-password' },
  ];

  let sectionTitles = {
    'scan': '— Aktionen',
    'dashboard': '— Übersicht',
    'stock-in': '— Verwaltung',
    'articles': '— Administration',
    'change-password': '— Konto'
  };

  items.filter(i => i.roles.includes(role)).forEach(item => {
    if (sectionTitles[item.page]) {
      const li = document.createElement('li');
      li.innerHTML = `<div class="sidebar-section-title">${sectionTitles[item.page]}</div>`;
      nav.appendChild(li);
    }
    const li = document.createElement('li');
    li.innerHTML = `<button class="nav-item" onclick="navigateTo('${item.page}')" id="nav-${item.page}">
      <span class="nav-icon">${item.icon}</span> ${item.label}
    </button>`;
    nav.appendChild(li);
  });
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  sb.classList.toggle('open');
  ov.classList.toggle('visible');
}

function setActiveNav(page) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const el = document.getElementById('nav-' + page);
  if (el) el.classList.add('active');
}

// ===== ROUTING =====
const pageTitles = {
  scan: 'Scan / Ausleihe',
  dashboard: 'Dashboard',
  articles: 'Artikel',
  users: 'Benutzerverwaltung',
  transactions: 'Transaktionen',
  'active-loans': 'Aktive Leihen',
  'stock-in': 'Einlagern',
  inventory: 'Inventur',
  'my-loans': 'Meine Leihen',
  'change-password': 'Passwort ändern'
};

async function navigateTo(page) {
  document.getElementById('page-title').textContent = pageTitles[page] || page;
  setActiveNav(page);
  const content = document.getElementById('content');
  content.innerHTML = '<div style="padding:40px;text-align:center;color:#ccc;font-size:24px;">⏳ Laden...</div>';

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('visible');

  switch(page) {
    case 'scan': await renderScan(); break;
    case 'dashboard': await renderDashboard(); break;
    case 'articles': await renderArticles(); break;
    case 'users': await renderUsers(); break;
    case 'transactions': await renderTransactions(); break;
    case 'active-loans': await renderActiveLoans(); break;
    case 'stock-in': await renderStockIn(); break;
    case 'inventory': await renderInventory(); break;
    case 'my-loans': await renderMyLoans(); break;
    case 'change-password': renderChangePassword(); break;
  }
}

// ===== ROLE HELPERS =====
function roleLabel(role) {
  return { admin: 'Administrator', verwalter: 'Verwalter', leihender: 'Leihender' }[role] || role;
}
function roleBadge(role) {
  const cls = { admin: 'badge-admin', verwalter: 'badge-verwalter', leihender: 'badge-leihender' }[role] || 'badge-gray';
  return `<span class="badge ${cls}">${roleLabel(role)}</span>`;
}
function typeBadge(type) {
  return type === 'leihgeraet'
    ? '<span class="badge badge-blue">Leihgerät</span>'
    : '<span class="badge badge-green">Verbrauchsmaterial</span>';
}
function txTypeBadge(type) {
  const map = {
    leihe: ['badge-blue', '📤 Leihe'],
    entnahme: ['badge-green', '📦 Entnahme'],
    rueckgabe: ['badge-orange', '↩️ Rückgabe'],
    einlagerung: ['badge-gray', '📥 Einlagerung'],
    inventur: ['badge-gray', '🗂️ Inventur']
  };
  const [cls, label] = map[type] || ['badge-gray', type];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ===== SCAN PAGE =====
async function renderScan() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="scan-area">
      <div class="scan-buttons">
        <div class="scan-btn-big active" id="mode-borrow" onclick="setScanMode('entnahme')" tabindex="0">
          <div class="scan-btn-icon">📤</div>
          <div class="scan-btn-label">Entnehmen / Ausleihen</div>
          <div class="scan-btn-desc">Material entnehmen oder Gerät ausleihen</div>
        </div>
        <div class="scan-btn-big" id="mode-return" onclick="setScanMode('rueckgabe')" tabindex="0">
          <div class="scan-btn-icon">↩️</div>
          <div class="scan-btn-label">Zurückgeben</div>
          <div class="scan-btn-desc">Ausgeliehenes Gerät zurückgeben</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="card-title"><span class="card-icon">📷</span> QR-Code scannen</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="openQRScanner()" style="flex:1;">
            📷 Kamera öffnen
          </button>
          <button class="btn btn-secondary" onclick="showManualInput()" style="flex:1;">
            ⌨️ Manuell eingeben
          </button>
        </div>
        <div id="manual-input-area" style="display:none;margin-top:14px;">
          <div class="form-group">
            <label>QR-Code oder Artikelnummer</label>
            <input type="text" id="manual-qr" placeholder="z.B. QR-MG-001" 
                   onkeydown="if(event.key==='Enter')submitManualQR()">
          </div>
          <button class="btn btn-primary btn-block" onclick="submitManualQR()">Suchen</button>
        </div>
      </div>

      <div id="scan-result-area"></div>
    </div>
  `;
  setScanMode('entnahme');
}

function setScanMode(mode) {
  qrScanMode = mode;
  currentArticle = null;
  document.getElementById('scan-result-area').innerHTML = '';
  document.getElementById('mode-borrow').classList.toggle('active', mode === 'entnahme');
  document.getElementById('mode-return').classList.toggle('active', mode === 'rueckgabe');
}

function showManualInput() {
  const area = document.getElementById('manual-input-area');
  area.style.display = area.style.display === 'none' ? 'block' : 'none';
  if (area.style.display !== 'none') document.getElementById('manual-qr').focus();
}

function submitManualQR() {
  const val = document.getElementById('manual-qr').value.trim();
  if (!val) return;
  handleQRResult(val);
}

async function handleQRResult(qrCode) {
  try {
    const res = await api(`/api/articles/qr/${encodeURIComponent(qrCode)}`);
    if (!res.ok) {
      showToast('Artikel nicht gefunden: ' + qrCode, 'error');
      return;
    }
    currentArticle = await res.json();
    renderArticlePreview(currentArticle);
  } catch {
    showToast('Fehler beim Laden des Artikels', 'error');
  }
}

function renderArticlePreview(article) {
  const resultArea = document.getElementById('scan-result-area');
  const stockColor = article.quantity <= article.min_quantity ? 'qty-warning' : '';
  const isReturn = qrScanMode === 'rueckgabe';
  const isConsumable = article.type === 'verbrauchsmaterial';

  if (isReturn && isConsumable) {
    resultArea.innerHTML = `<div class="alert alert-error">Verbrauchsmaterial kann nicht zurückgegeben werden.</div>`;
    return;
  }

  const dueInfo = (!isReturn && article.type === 'leihgeraet' && article.loan_duration_days)
    ? `<div class="alert alert-info" style="margin-bottom:0">
        ⏰ Leihfrist: <strong>${article.loan_duration_days} Tage</strong>
        (Rückgabe bis: ${formatDueDate(article.loan_duration_days)})
       </div>`
    : '';

  resultArea.innerHTML = `
    <div class="article-preview">
      <div class="article-preview-name">${escHtml(article.name)}</div>
      <div class="article-preview-meta">
        ${typeBadge(article.type)}
        ${article.category ? `<span class="badge badge-gray">${escHtml(article.category.name)}</span>` : ''}
        ${article.location ? `<span class="badge badge-gray">📍 ${escHtml(article.location)}</span>` : ''}
      </div>
      ${article.description ? `<p style="font-size:14px;color:#666;margin-bottom:12px;">${escHtml(article.description)}</p>` : ''}

      <div class="quantity-display">
        <div class="qty-num ${stockColor}">${article.quantity}</div>
        <div class="qty-unit ${stockColor}">${escHtml(article.unit)} verfügbar
          ${article.quantity <= article.min_quantity ? '<br><small>⚠️ Mindestbestand erreicht</small>' : ''}
        </div>
      </div>

      ${!isReturn ? `
      <div class="form-group">
        <label>Menge</label>
        <input type="number" id="scan-qty" value="1" min="1" max="${article.quantity}" style="text-align:center;font-size:20px;font-weight:700;">
      </div>` : ''}

      <div class="form-group">
        <label>Notiz (optional)</label>
        <input type="text" id="scan-notes" placeholder="z.B. Für Patient XY">
      </div>

      ${dueInfo}
    </div>

    <button class="btn btn-${isReturn ? 'warning' : 'primary'} btn-block" onclick="confirmScan()" style="margin-bottom:8px;">
      ${isReturn ? '↩️ Gerät zurückgeben' : (article.type === 'leihgeraet' ? '📤 Gerät ausleihen' : '📦 Material entnehmen')}
    </button>
    <button class="btn btn-secondary btn-block" onclick="document.getElementById('scan-result-area').innerHTML=''">Abbrechen</button>
  `;
}

function formatDueDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('de-AT');
}

async function confirmScan() {
  if (!currentArticle) return;
  const isReturn = qrScanMode === 'rueckgabe';
  const qty = isReturn ? 1 : parseInt(document.getElementById('scan-qty').value) || 1;
  const notes = document.getElementById('scan-notes').value;

  try {
    const endpoint = isReturn ? '/api/transactions/return' : '/api/transactions/scan';
    const res = await api(endpoint, {
      method: 'POST',
      body: { qr_code: currentArticle.qr_code, quantity: qty, notes }
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Fehler', 'error');
      return;
    }
    showToast(data.message || 'Erfolgreich!', 'success');
    currentArticle = null;
    document.getElementById('scan-result-area').innerHTML = `
      <div class="alert alert-success" style="font-size:16px;text-align:center;padding:20px;">
        ✅ ${escHtml(data.message || 'Vorgang erfolgreich!')}
      </div>`;
  } catch {
    showToast('Verbindungsfehler', 'error');
  }
}

// ===== QR SCANNER =====
function openQRScanner() {
  document.getElementById('qr-scanner-overlay').style.display = 'flex';
  qrScanner = new Html5Qrcode('qr-reader');
  qrScanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    (decodedText) => {
      closeQRScanner();
      // Extract QR code from URL if needed
      let qrCode = decodedText;
      try {
        const url = new URL(decodedText);
        qrCode = url.searchParams.get('qr') || decodedText;
      } catch {}
      handleQRResult(qrCode);
    }
  ).catch(err => {
    showToast('Kamera nicht verfügbar: ' + err, 'error');
    closeQRScanner();
  });
}

function closeQRScanner() {
  if (qrScanner) {
    qrScanner.stop().catch(() => {});
    qrScanner = null;
  }
  document.getElementById('qr-scanner-overlay').style.display = 'none';
}

// ===== DASHBOARD =====
async function renderDashboard() {
  const res = await api('/api/dashboard');
  const data = await res.json();
  const { stats, recentTransactions, belowMin, overdueLoans } = data;

  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon red">📦</div>
        <div><div class="stat-value">${stats.totalArticles}</div><div class="stat-label">Artikel gesamt</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue">📤</div>
        <div><div class="stat-value">${stats.totalLoans}</div><div class="stat-label">Aktive Leihen</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">⚠️</div>
        <div><div class="stat-value">${stats.belowMinCount}</div><div class="stat-label">Unter Mindestbestand</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red">🔴</div>
        <div><div class="stat-value">${stats.overdueCount}</div><div class="stat-label">Überfällige Leihen</div></div>
      </div>
    </div>

    ${belowMin.length > 0 ? `
    <div class="card" style="margin-bottom:20px;border-left:4px solid var(--warning);">
      <div class="card-title">⚠️ Artikel unter Mindestbestand</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Artikel</th><th>Bestand</th><th>Minimum</th><th>Delta</th><th>Ort</th></tr></thead>
          <tbody>
            ${belowMin.map(a => `
              <tr class="low-stock-row">
                <td><strong>${escHtml(a.name)}</strong></td>
                <td><strong style="color:var(--danger)">${a.quantity} ${escHtml(a.unit)}</strong></td>
                <td>${a.min_quantity} ${escHtml(a.unit)}</td>
                <td style="color:var(--danger);font-weight:700;">${a.quantity - a.min_quantity}</td>
                <td>${a.location ? escHtml(a.location) : '-'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}

    ${overdueLoans.length > 0 ? `
    <div class="card" style="margin-bottom:20px;border-left:4px solid var(--danger);">
      <div class="card-title">🔴 Überfällige Leihen</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Gerät</th><th>Leihender</th><th>Fällig am</th><th>Überfällig seit</th></tr></thead>
          <tbody>
            ${overdueLoans.map(l => `
              <tr class="overdue-row">
                <td><strong>${escHtml(l.article?.name)}</strong></td>
                <td>${escHtml(l.user?.full_name)}<br><small style="color:#888">${escHtml(l.user?.email)}</small></td>
                <td style="color:var(--danger);font-weight:600;">${formatDate(l.due_date)}</td>
                <td>${daysSince(l.due_date)} Tage</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}

    <div class="card">
      <div class="card-title"><span class="card-icon">🕐</span> Letzte Transaktionen</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Datum</th><th>Typ</th><th>Artikel</th><th>Menge</th><th>Benutzer</th></tr></thead>
          <tbody>
            ${recentTransactions.length === 0 ? '<tr><td colspan="5"><div class="empty-state"><p>Keine Transaktionen</p></div></td></tr>' : ''}
            ${recentTransactions.map(t => `
              <tr>
                <td style="white-space:nowrap;font-size:13px;">${formatDateTime(t.created_at || t.createdAt)}</td>
                <td>${txTypeBadge(t.type)}</td>
                <td>${escHtml(t.article?.name || '-')}</td>
                <td>${t.quantity} ${escHtml(t.article?.unit || '')}</td>
                <td>${escHtml(t.user?.full_name || '-')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ===== ARTICLES =====
async function renderArticles() {
  const [artRes, catRes] = await Promise.all([
    api('/api/articles?active=all'),
    api('/api/articles/meta/categories')
  ]);
  const articles = await artRes.json();
  const categories = await catRes.json();
  const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="action-bar">
      <div class="action-bar-title">Artikel (${articles.length})</div>
      ${currentUser.role === 'admin' ? `<button class="btn btn-primary" onclick="showArticleModal(null)">+ Neuer Artikel</button>` : ''}
    </div>
    <div class="search-bar">
      <input class="search-input" placeholder="🔍 Suche..." id="article-search" oninput="filterTable('articles-table', this.value)">
      <select id="article-type-filter" onchange="filterArticleTable()" style="padding:9px 12px;border:1.5px solid var(--moki-border);border-radius:8px;font-family:var(--font-main);">
        <option value="">Alle Typen</option>
        <option value="leihgeraet">Leihgeräte</option>
        <option value="verbrauchsmaterial">Verbrauchsmaterial</option>
      </select>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table id="articles-table">
          <thead>
            <tr>
              <th>Nr.</th><th>Name</th><th>Typ</th><th>Kategorie</th>
              <th>Bestand</th><th>Min.</th><th>Ort</th><th>Status</th>
              ${currentUser.role === 'admin' ? '<th>Aktionen</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${articles.length === 0 ? '<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">📦</div><h3>Keine Artikel</h3></div></td></tr>' : ''}
            ${articles.map(a => `
              <tr data-type="${a.type}" class="${!a.active ? 'opacity-50' : ''}">
                <td><code style="font-size:12px">${escHtml(a.article_number || '-')}</code></td>
                <td>
                  <strong>${escHtml(a.name)}</strong>
                  ${a.description ? `<br><small style="color:#888">${escHtml(a.description.substring(0,60))}${a.description.length > 60 ? '...' : ''}</small>` : ''}
                </td>
                <td>${typeBadge(a.type)}</td>
                <td>${escHtml(catMap[a.category_id] || '-')}</td>
                <td>
                  <span style="font-weight:700;color:${a.quantity <= a.min_quantity ? 'var(--danger)' : 'inherit'}">${a.quantity}</span>
                  <span style="color:#888;font-size:12px;"> ${escHtml(a.unit)}</span>
                </td>
                <td>${a.min_quantity} ${escHtml(a.unit)}</td>
                <td style="font-size:13px;">${a.location ? escHtml(a.location) : '-'}</td>
                <td>${a.active ? '<span class="badge badge-green">Aktiv</span>' : '<span class="badge badge-gray">Inaktiv</span>'}</td>
                ${currentUser.role === 'admin' ? `
                <td style="white-space:nowrap;">
                  <button class="btn btn-secondary btn-sm" onclick='showArticleModal_byId(${a.id})'>✏️</button>
                  <button class="btn btn-secondary btn-sm" onclick="showQRCode(${a.id}, '${escHtml(a.name)}')">📱</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteArticle(${a.id})">🗑️</button>
                </td>` : ''}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  window._categories = categories;
  window._articles = articles;
}
function showArticleModal_byId(id) {
  const article = (window._articles || []).find(a => a.id === id);
  showArticleModal(article || null);
}


function showArticleModal(article, categories) {
  const cats = Array.isArray(categories) ? categories : (window._categories || []);
  const isEdit = !!article;
  openModal(isEdit ? 'Artikel bearbeiten' : 'Neuer Artikel', `
    <div class="form-row">
      <div class="form-group">
        <label>Name *</label>
        <input type="text" id="am-name" value="${isEdit ? escHtml(article.name) : ''}" required>
      </div>
      <div class="form-group">
        <label>Artikelnummer</label>
        <input type="text" id="am-number" value="${isEdit ? escHtml(article.article_number || '') : ''}">
      </div>
    </div>
    <div class="form-group">
      <label>Beschreibung</label>
      <textarea id="am-desc">${isEdit ? escHtml(article.description || '') : ''}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Typ *</label>
        <select id="am-type" onchange="toggleLoanDays()">
          <option value="leihgeraet" ${isEdit && article.type === 'leihgeraet' ? 'selected' : ''}>Leihgerät</option>
          <option value="verbrauchsmaterial" ${isEdit && article.type === 'verbrauchsmaterial' ? 'selected' : ''}>Verbrauchsmaterial</option>
        </select>
      </div>
      <div class="form-group">
        <label>Kategorie</label>
        <select id="am-cat">
          <option value="">Keine</option>
          ${cats.map(c => `<option value="${c.id}" ${isEdit && article.category_id == c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group" id="loan-days-group" style="${isEdit && article.type === 'verbrauchsmaterial' ? 'display:none' : ''}">
        <label>Leihdauer (Tage)</label>
        <input type="number" id="am-days" value="${isEdit ? (article.loan_duration_days || '') : '14'}" min="1">
      </div>
      <div class="form-group">
        <label>Einheit</label>
        <input type="text" id="am-unit" value="${isEdit ? escHtml(article.unit || 'Stück') : 'Stück'}">
      </div>
    </div>
    <div class="form-row">
      ${!isEdit ? `<div class="form-group">
        <label>Anfangsbestand</label>
        <input type="number" id="am-qty" value="0" min="0">
      </div>` : '<div></div>'}
      <div class="form-group">
        <label>Mindestbestand</label>
        <input type="number" id="am-min" value="${isEdit ? article.min_quantity : '0'}" min="0">
      </div>
    </div>
    <div class="form-group">
      <label>Lagerort</label>
      <input type="text" id="am-loc" value="${isEdit ? escHtml(article.location || '') : ''}">
    </div>
    ${isEdit ? `
    <div class="form-group">
      <label>Status</label>
      <select id="am-active">
        <option value="1" ${article.active ? 'selected' : ''}>Aktiv</option>
        <option value="0" ${!article.active ? 'selected' : ''}>Inaktiv</option>
      </select>
    </div>` : ''}
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
      <button class="btn btn-primary" onclick="saveArticle(${isEdit ? article.id : 'null'})">
        ${isEdit ? '💾 Speichern' : '+ Erstellen'}
      </button>
    </div>
  `);
}

function toggleLoanDays() {
  const type = document.getElementById('am-type').value;
  document.getElementById('loan-days-group').style.display = type === 'verbrauchsmaterial' ? 'none' : '';
}

async function saveArticle(id) {
  const body = {
    name: document.getElementById('am-name').value.trim(),
    description: document.getElementById('am-desc').value.trim(),
    article_number: document.getElementById('am-number').value.trim(),
    type: document.getElementById('am-type').value,
    category_id: document.getElementById('am-cat').value || null,
    loan_duration_days: document.getElementById('am-days')?.value || null,
    unit: document.getElementById('am-unit').value.trim() || 'Stück',
    min_quantity: parseInt(document.getElementById('am-min').value) || 0,
    location: document.getElementById('am-loc').value.trim(),
  };
  if (!id) body.quantity = parseInt(document.getElementById('am-qty')?.value) || 0;
  if (id) body.active = document.getElementById('am-active').value === '1';

  const res = await api(id ? `/api/articles/${id}` : '/api/articles', {
    method: id ? 'PUT' : 'POST', body
  });
  const data = await res.json();
  if (!res.ok) { showToast(data.error || 'Fehler', 'error'); return; }
  closeModal();
  showToast(id ? 'Artikel aktualisiert' : 'Artikel erstellt', 'success');
  renderArticles();
}

async function deleteArticle(id) {
  if (!confirm('Artikel wirklich deaktivieren?')) return;
  const res = await api(`/api/articles/${id}`, { method: 'DELETE' });
  if (res.ok) { showToast('Artikel deaktiviert', 'success'); renderArticles(); }
  else showToast('Fehler beim Löschen', 'error');
}

async function showQRCode(id, name) {
  const res = await api(`/api/articles/${id}/qrcode`);
  const data = await res.json();
  openModal(`QR-Code: ${name}`, `
    <div class="qr-display-card">
      <img src="${data.qr_image}" alt="QR Code">
      <h3>${escHtml(name)}</h3>
      <div class="qr-code-text">${escHtml(data.qr_code)}</div>
      <p style="font-size:12px;color:#888;margin-top:8px;">URL: ${escHtml(data.scan_url)}</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Schließen</button>
      <button class="btn btn-primary" onclick="printQR()">🖨️ Drucken</button>
    </div>
  `);
}

function printQR() { window.print(); }

// ===== USERS =====
async function renderUsers() {
  const res = await api('/api/users');
  const users = await res.json();
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="action-bar">
      <div class="action-bar-title">Benutzer (${users.length})</div>
      <button class="btn btn-primary" onclick="showUserModal(null)">+ Neuer Benutzer</button>
    </div>
    <div class="search-bar">
      <input class="search-input" placeholder="🔍 Suche..." id="user-search" oninput="filterTable('users-table', this.value)">
    </div>
    <div class="card">
      <div class="table-wrap">
        <table id="users-table">
          <thead><tr><th>Name</th><th>Benutzername</th><th>E-Mail</th><th>Rolle</th><th>Status</th><th>Erstellt</th><th>Aktionen</th></tr></thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td><strong>${escHtml(u.full_name)}</strong></td>
                <td><code>${escHtml(u.username)}</code></td>
                <td>${escHtml(u.email)}</td>
                <td>${roleBadge(u.role)}</td>
                <td>${u.active ? '<span class="badge badge-green">Aktiv</span>' : '<span class="badge badge-gray">Inaktiv</span>'}</td>
                <td style="font-size:13px;color:#888;">${formatDate(u.created_at)}</td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick='showUserModal(${JSON.stringify(u)})'>✏️</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">🗑️</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function showUserModal(user) {
  const isEdit = !!user;
  openModal(isEdit ? 'Benutzer bearbeiten' : 'Neuer Benutzer', `
    <div class="form-row">
      <div class="form-group">
        <label>Vollständiger Name *</label>
        <input type="text" id="um-name" value="${isEdit ? escHtml(user.full_name) : ''}">
      </div>
      <div class="form-group">
        <label>Benutzername *</label>
        <input type="text" id="um-user" value="${isEdit ? escHtml(user.username) : ''}" ${isEdit ? 'readonly' : ''}>
      </div>
    </div>
    <div class="form-group">
      <label>E-Mail *</label>
      <input type="email" id="um-email" value="${isEdit ? escHtml(user.email) : ''}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Rolle *</label>
        <select id="um-role">
          <option value="leihender" ${isEdit && user.role === 'leihender' ? 'selected' : ''}>Leihender</option>
          <option value="verwalter" ${isEdit && user.role === 'verwalter' ? 'selected' : ''}>Verwalter</option>
          <option value="admin" ${isEdit && user.role === 'admin' ? 'selected' : ''}>Administrator</option>
        </select>
      </div>
      ${isEdit ? `<div class="form-group">
        <label>Status</label>
        <select id="um-active">
          <option value="1" ${user.active ? 'selected' : ''}>Aktiv</option>
          <option value="0" ${!user.active ? 'selected' : ''}>Inaktiv</option>
        </select>
      </div>` : '<div></div>'}
    </div>
    <div class="form-group">
      <label>${isEdit ? 'Neues Passwort (leer lassen = unverändert)' : 'Passwort *'}</label>
      <input type="password" id="um-pass" placeholder="${isEdit ? 'Leer = unverändert' : 'Mindestens 6 Zeichen'}">
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
      <button class="btn btn-primary" onclick="saveUser(${isEdit ? user.id : 'null'})">${isEdit ? '💾 Speichern' : '+ Erstellen'}</button>
    </div>
  `);
}

async function saveUser(id) {
  const body = {
    full_name: document.getElementById('um-name').value.trim(),
    email: document.getElementById('um-email').value.trim(),
    role: document.getElementById('um-role').value,
  };
  if (!id) body.username = document.getElementById('um-user').value.trim();
  const pass = document.getElementById('um-pass').value;
  if (pass) body.password = pass;
  if (!id && !pass) { showToast('Passwort erforderlich', 'error'); return; }
  if (id) body.active = document.getElementById('um-active').value === '1';

  const res = await api(id ? `/api/users/${id}` : '/api/users', { method: id ? 'PUT' : 'POST', body });
  const data = await res.json();
  if (!res.ok) { showToast(data.error || 'Fehler', 'error'); return; }
  closeModal();
  showToast(id ? 'Benutzer aktualisiert' : 'Benutzer erstellt', 'success');
  renderUsers();
}

async function deleteUser(id) {
  if (!confirm('Benutzer wirklich löschen?')) return;
  const res = await api(`/api/users/${id}`, { method: 'DELETE' });
  if (res.ok) { showToast('Benutzer gelöscht', 'success'); renderUsers(); }
  else showToast('Fehler', 'error');
}

// ===== TRANSACTIONS =====
async function renderTransactions() {
  const res = await api('/api/transactions?limit=100');
  const data = await res.json();
  const txns = data.rows || data;

  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="action-bar">
      <div class="action-bar-title">Transaktionen (${txns.length})</div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Datum</th><th>Typ</th><th>Artikel</th><th>Menge</th><th>Vorher</th><th>Nachher</th><th>Benutzer</th><th>Notiz</th></tr></thead>
          <tbody>
            ${txns.length === 0 ? '<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">📋</div><h3>Keine Transaktionen</h3></div></td></tr>' : ''}
            ${txns.map(t => `
              <tr>
                <td style="font-size:13px;white-space:nowrap;">${formatDateTime(t.created_at || t.createdAt)}</td>
                <td>${txTypeBadge(t.type)}</td>
                <td>${escHtml(t.article?.name || '-')}</td>
                <td>${t.quantity} ${escHtml(t.article?.unit || '')}</td>
                <td style="color:#888">${t.quantity_before}</td>
                <td style="font-weight:600">${t.quantity_after}</td>
                <td>${escHtml(t.user?.full_name || '-')}</td>
                <td style="font-size:13px;color:#888">${escHtml(t.notes || '')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ===== ACTIVE LOANS =====
async function renderActiveLoans() {
  const res = await api('/api/transactions/active-loans');
  const loans = await res.json();
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="action-bar">
      <div class="action-bar-title">Aktive Leihen (${loans.length})</div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Gerät</th><th>Leihender</th><th>E-Mail</th><th>Menge</th><th>Ausgeliehen</th><th>Fällig</th><th>Status</th></tr></thead>
          <tbody>
            ${loans.length === 0 ? '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">✅</div><h3>Keine aktiven Leihen</h3></div></td></tr>' : ''}
            ${loans.map(l => `
              <tr class="${l.overdue ? 'overdue-row' : ''}">
                <td><strong>${escHtml(l.article?.name || '-')}</strong></td>
                <td>${escHtml(l.user?.full_name || '-')}</td>
                <td style="font-size:13px;">${escHtml(l.user?.email || '-')}</td>
                <td>${l.quantity} ${escHtml(l.article?.unit || '')}</td>
                <td style="font-size:13px;">${formatDate(l.loan_date)}</td>
                <td style="font-weight:${l.overdue ? '700' : 'normal'};color:${l.overdue ? 'var(--danger)' : 'inherit'}">${formatDate(l.due_date)}</td>
                <td>${l.overdue ? '<span class="badge badge-red">🔴 Überfällig</span>' : '<span class="badge badge-blue">Aktiv</span>'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ===== STOCK IN =====
async function renderStockIn() {
  const res = await api('/api/articles');
  const articles = await res.json();
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card">
      <div class="card-title"><span class="card-icon">📥</span> Material einlagern</div>
      <div class="form-group">
        <label>Artikel *</label>
        <select id="si-article" style="width:100%;padding:10px 14px;border:1.5px solid var(--moki-border);border-radius:8px;font-family:var(--font-main);font-size:15px;">
          <option value="">-- Artikel wählen --</option>
          ${articles.map(a => `<option value="${a.id}">${escHtml(a.name)} (${escHtml(a.type === 'leihgeraet' ? 'Leihgerät' : 'Verbrauchsmaterial')}) – Bestand: ${a.quantity} ${escHtml(a.unit)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Menge *</label>
          <input type="number" id="si-qty" value="1" min="1" style="font-size:20px;font-weight:700;text-align:center;">
        </div>
        <div class="form-group">
          <label>Notiz</label>
          <input type="text" id="si-notes" placeholder="z.B. Lieferung 05/2025">
        </div>
      </div>
      <button class="btn btn-primary btn-block" onclick="submitStockIn()">📥 Einlagern</button>
    </div>
  `;
}

async function submitStockIn() {
  const article_id = document.getElementById('si-article').value;
  const quantity = parseInt(document.getElementById('si-qty').value);
  const notes = document.getElementById('si-notes').value;
  if (!article_id || !quantity || quantity < 1) {
    showToast('Bitte Artikel und Menge angeben', 'error'); return;
  }
  const res = await api('/api/transactions/stock', { method: 'POST', body: { article_id, quantity, notes } });
  const data = await res.json();
  if (!res.ok) { showToast(data.error || 'Fehler', 'error'); return; }
  showToast(`Erfolgreich eingelagert! Neuer Bestand: ${data.new_quantity}`, 'success');
  renderStockIn();
}

// ===== INVENTORY =====
async function renderInventory() {
  const [artRes, sessRes] = await Promise.all([
    api('/api/articles'),
    api('/api/inventory/sessions')
  ]);
  const articles = await artRes.json();
  const sessions = await sessRes.json();

  const content = document.getElementById('content');
  content.innerHTML = `
    <div style="display:grid;gap:20px;grid-template-columns:1fr 1fr;">
      <div class="card">
        <div class="card-title"><span class="card-icon">🗂️</span> Neue Inventur starten</div>
        <div class="form-group">
          <label>Notiz</label>
          <input type="text" id="inv-notes" placeholder="z.B. Monatliche Inventur Mai 2025">
        </div>
        <button class="btn btn-primary btn-block" onclick="startInventory()">🗂️ Inventur starten</button>
      </div>

      <div class="card">
        <div class="card-title"><span class="card-icon">📋</span> Letzte Inventuren</div>
        ${sessions.length === 0 ? '<div class="empty-state"><p>Keine Inventuren vorhanden</p></div>' : ''}
        ${sessions.slice(0, 5).map(s => `
          <div style="padding:10px 0;border-bottom:1px solid var(--moki-border);">
            <div style="font-weight:600;font-size:14px;">${formatDateTime(s.started_at || s.startedAt)}</div>
            <div style="font-size:13px;color:#888;">${s.notes || 'Keine Notiz'}</div>
            <span class="badge ${s.completed_at ? 'badge-green' : 'badge-orange'}" style="margin-top:4px;">
              ${s.completed_at ? '✅ Abgeschlossen' : '⏳ Offen'}
            </span>
          </div>`).join('')}
      </div>
    </div>

    <div id="inventory-form" style="display:none;margin-top:20px;">
      <div class="card">
        <div class="card-title"><span class="card-icon">📦</span> Artikel zählen</div>
        <div id="inventory-session-info" style="margin-bottom:16px;"></div>
        <div class="inventory-list" id="inventory-items-list">
          ${articles.map(a => `
            <div class="inventory-item" id="inv-item-${a.id}">
              <div class="inventory-item-info">
                <div class="inventory-item-name">${escHtml(a.name)}</div>
                <div class="inventory-item-sub">System: ${a.quantity} ${escHtml(a.unit)} ${typeBadge(a.type)}</div>
              </div>
              <input type="number" class="inventory-qty-input" id="inv-count-${a.id}" 
                     placeholder="${a.quantity}" min="0" title="${escHtml(a.name)}">
            </div>
          `).join('')}
        </div>
        <div style="margin-top:20px;display:flex;gap:10px;">
          <button class="btn btn-secondary" onclick="cancelInventory()">Abbrechen</button>
          <button class="btn btn-primary" onclick="completeInventory()">✅ Inventur abschließen</button>
        </div>
      </div>
    </div>
  `;
  window._inventoryArticles = articles;
}

let currentInventorySession = null;

async function startInventory() {
  const notes = document.getElementById('inv-notes').value;
  const res = await api('/api/inventory/start', { method: 'POST', body: { notes } });
  const data = await res.json();
  if (!res.ok) { showToast(data.error || 'Fehler', 'error'); return; }
  currentInventorySession = data;
  document.getElementById('inventory-form').style.display = 'block';
  document.getElementById('inventory-session-info').innerHTML = `
    <div class="alert alert-info">Inventur #${data.id} gestartet – ${formatDateTime(data.started_at)}</div>`;
  showToast('Inventur gestartet', 'success');
}

function cancelInventory() {
  currentInventorySession = null;
  document.getElementById('inventory-form').style.display = 'none';
}

async function completeInventory() {
  if (!currentInventorySession) return;
  const articles = window._inventoryArticles || [];
  let hasChanges = false;
  for (const a of articles) {
    const input = document.getElementById('inv-count-' + a.id);
    const val = input.value.trim();
    if (val !== '') {
      hasChanges = true;
      await api(`/api/inventory/${currentInventorySession.id}/count`, {
        method: 'POST',
        body: { article_id: a.id, counted_quantity: parseInt(val), notes: '' }
      });
    }
  }
  if (!hasChanges) { showToast('Bitte mindestens einen Artikel zählen', 'error'); return; }
  const res = await api(`/api/inventory/${currentInventorySession.id}/complete`, { method: 'POST' });
  if (!res.ok) { showToast('Fehler beim Abschließen', 'error'); return; }
  showToast('Inventur abgeschlossen!', 'success');
  currentInventorySession = null;
  renderInventory();
}

// ===== MY LOANS =====
async function renderMyLoans() {
  const res = await api('/api/transactions/my-loans');
  const loans = await res.json();
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="action-bar">
      <div class="action-bar-title">Meine aktiven Leihen (${loans.length})</div>
    </div>
    ${loans.length === 0 ? '<div class="card"><div class="empty-state"><div class="empty-state-icon">✅</div><h3>Keine aktiven Leihen</h3><p>Sie haben aktuell keine ausgeliehenen Geräte.</p></div></div>' : ''}
    ${loans.map(l => `
      <div class="card" style="margin-bottom:12px;border-left:4px solid ${l.overdue ? 'var(--danger)' : 'var(--info)'}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-family:var(--font-heading);font-size:20px;font-weight:700;margin-bottom:6px;">${escHtml(l.article?.name)}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
              <span class="badge badge-blue">Leihgerät</span>
              ${l.overdue ? '<span class="badge badge-red">🔴 ÜBERFÄLLIG</span>' : '<span class="badge badge-green">Aktiv</span>'}
            </div>
            <div style="font-size:14px;color:#666;">
              📅 Ausgeliehen: ${formatDate(l.loan_date)}<br>
              ⏰ Rückgabe bis: <strong style="color:${l.overdue ? 'var(--danger)' : 'inherit'}">${formatDate(l.due_date)}</strong>
            </div>
          </div>
          <button class="btn btn-warning" onclick="returnLoan('${l.article?.qr_code}')">↩️ Zurückgeben</button>
        </div>
      </div>
    `).join('')}
  `;
}

async function returnLoan(qrCode) {
  if (!confirm('Gerät jetzt zurückgeben?')) return;
  const res = await api('/api/transactions/return', { method: 'POST', body: { qr_code: qrCode } });
  const data = await res.json();
  if (!res.ok) { showToast(data.error || 'Fehler', 'error'); return; }
  showToast('Gerät zurückgegeben!', 'success');
  renderMyLoans();
}

// ===== CHANGE PASSWORD =====
function renderChangePassword() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card" style="max-width:420px;">
      <div class="card-title"><span class="card-icon">🔑</span> Passwort ändern</div>
      <div class="form-group">
        <label>Aktuelles Passwort</label>
        <input type="password" id="cp-current" placeholder="Aktuelles Passwort">
      </div>
      <div class="form-group">
        <label>Neues Passwort</label>
        <input type="password" id="cp-new" placeholder="Mindestens 6 Zeichen">
      </div>
      <div class="form-group">
        <label>Neues Passwort bestätigen</label>
        <input type="password" id="cp-confirm" placeholder="Wiederholen">
      </div>
      <button class="btn btn-primary btn-block" onclick="changePassword()">🔑 Passwort ändern</button>
    </div>
  `;
}

async function changePassword() {
  const current = document.getElementById('cp-current').value;
  const newPass = document.getElementById('cp-new').value;
  const confirm = document.getElementById('cp-confirm').value;
  if (newPass !== confirm) { showToast('Passwörter stimmen nicht überein', 'error'); return; }
  if (newPass.length < 6) { showToast('Mindestens 6 Zeichen', 'error'); return; }
  const res = await api('/api/auth/change-password', { method: 'POST', body: { current_password: current, new_password: newPass } });
  const data = await res.json();
  if (!res.ok) { showToast(data.error || 'Fehler', 'error'); return; }
  showToast('Passwort erfolgreich geändert', 'success');
}

// ===== MODAL =====
function openModal(title, body) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal-overlay').style.display = 'flex';
}
function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').style.display = 'none';
}

// ===== TOAST =====
function showToast(msg, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${escHtml(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.4s'; setTimeout(() => toast.remove(), 400); }, duration);
}

// ===== UTILS =====
function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('de-AT');
}
function getDate(obj, field) {
  return obj[field] || obj[field.replace(/_(.)/g, (_, c) => c.toUpperCase())] || null;
}
function formatDateTime(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('de-AT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function daysSince(d) {
  const diff = new Date() - new Date(d);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
function filterTable(tableId, query) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const q = query.toLowerCase();
  table.querySelectorAll('tbody tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}
function filterArticleTable() {
  const type = document.getElementById('article-type-filter').value;
  const search = document.getElementById('article-search').value.toLowerCase();
  document.querySelectorAll('#articles-table tbody tr').forEach(row => {
    const matchType = !type || row.dataset.type === type;
    const matchSearch = !search || row.textContent.toLowerCase().includes(search);
    row.style.display = matchType && matchSearch ? '' : 'none';
  });
}
