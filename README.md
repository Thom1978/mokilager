# 🏥 MOKILager – Lagerverwaltungssystem

Lagerverwaltung für Medizinutensilien und Medizingeräte der **OÖ MOKI – Mobile Kinderkrankenpflege**.

---

## ✨ Funktionen

### Rollen & Berechtigungen
| Funktion | Leihender | Verwalter | Administrator |
|---|:---:|:---:|:---:|
| Artikel ausleihen / entnehmen | ✅ | ✅ | ✅ |
| Gerät zurückgeben | ✅ | ✅ | ✅ |
| Eigene Leihen anzeigen | ✅ | ✅ | ✅ |
| Dashboard (Übersicht) | ❌ | ✅ | ✅ |
| Transaktionsliste | ❌ | ✅ | ✅ |
| Aktive Leihen verwalten | ❌ | ✅ | ✅ |
| Material einlagern | ❌ | ✅ | ✅ |
| Inventur durchführen | ❌ | ✅ | ✅ |
| Artikel anlegen/bearbeiten | ❌ | ❌ | ✅ |
| Benutzer verwalten | ❌ | ❌ | ✅ |

### Kernfunktionen
- 📷 **QR-Code Scanning** per Handy-Kamera
- 📤 **Ausleihe** (Leihgeräte mit Fristüberwachung)
- 📦 **Entnahme** von Verbrauchsmaterialien
- ↩️ **Rückgabe** via QR-Scan
- 📧 **E-Mail-Erinnerungen** bei überfälligen Leihen (täglich 8:00 Uhr)
- 📊 **Dashboard** mit Echtzeit-Bestandswarnungen
- 🗂️ **Inventur** mit automatischer Bestandskorrektur

---

## 🚀 Installation

### Voraussetzungen
- Docker & Docker Compose
- GitHub-Account (für das Container-Image)

### Schnellstart

```bash
# 1. Repository klonen
git clone https://github.com/IHRGITHUB/mokilager.git
cd mokilager

# 2. Umgebungsvariablen konfigurieren
cp .env.example .env
nano .env   # Passwörter und SMTP anpassen!

# 3. Starten
docker compose up -d

# 4. Aufrufen
# http://localhost:3000
```

### Standard-Login
| Feld | Wert |
|---|---|
| Benutzername | `mokiadmin` |
| Passwort | `admin` |

> ⚠️ **Bitte sofort nach dem ersten Login das Passwort ändern!**

---

## 🐳 Docker Image von GitHub

Das Image wird automatisch über GitHub Actions gebaut und in der GitHub Container Registry veröffentlicht.

### docker-compose.yml für Produktion

```yaml
version: '3.8'
services:
  db:
    image: mariadb:10.11
    environment:
      MYSQL_ROOT_PASSWORD: IhrSicheresPasswort
      MYSQL_DATABASE: mokilager
      MYSQL_USER: mokilager
      MYSQL_PASSWORD: IhrDBPasswort
    volumes:
      - db_data:/var/lib/mysql
      - ./docker/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    restart: unless-stopped

  app:
    image: ghcr.io/IHRGITHUBNAME/mokilager:latest
    ports:
      - "3000:3000"
    environment:
      DB_HOST: db
      DB_USER: mokilager
      DB_PASSWORD: IhrDBPasswort
      SESSION_SECRET: IhrSessionSecret
      APP_URL: https://lager.ihrserver.at
      SMTP_HOST: smtp.ihrserver.at
      SMTP_USER: noreply@ihrserver.at
      SMTP_PASS: IhrSMTPPasswort
    depends_on: [db]
    restart: unless-stopped

volumes:
  db_data:
```

---

## 📱 QR-Code Verwendung

1. Admin erstellt Artikel → QR-Code wird automatisch generiert
2. QR-Code ausdrucken (Admin → Artikel → 📱-Button)
3. Am Gerät/Regal befestigen
4. Leihende scannen mit Handy → automatisch Ausleihe/Entnahme

**Direktlink:** `https://IHR-SERVER/scan?qr=QR-XXXXXX`

---

## 🔧 GitHub Actions Setup

1. Repository anlegen und Code pushen
2. Unter **Settings → Actions → General** → "Workflow permissions": Read and write aktivieren
3. Bei jedem Push auf `main` wird das Docker-Image automatisch gebaut und zu `ghcr.io` gepusht

---

## 📧 E-Mail Konfiguration

Für Leiherinnerungen SMTP konfigurieren:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ihre@email.at
SMTP_PASS=app-passwort
SMTP_FROM=MOKILager <lager@moki.at>
```

---

## 🔒 Sicherheitshinweise

- Passwort von `mokiadmin` nach dem ersten Login ändern
- `SESSION_SECRET` in `.env` auf einen langen Zufallsstring setzen
- In Produktion HTTPS verwenden (z.B. Nginx Reverse Proxy mit Let's Encrypt)
- Regelmäßige Datenbank-Backups einrichten:
  ```bash
  docker exec mokilager-db mysqldump -u mokilager -p mokilager > backup.sql
  ```

---

## 📁 Projektstruktur

```
mokilager/
├── .github/workflows/    # GitHub Actions
├── backend/
│   ├── src/
│   │   ├── models/       # Sequelize ORM
│   │   ├── routes/       # API Endpoints
│   │   ├── middleware/   # Auth
│   │   ├── services/     # Loan reminders
│   │   └── server.js
│   └── package.json
├── frontend/public/
│   ├── css/style.css
│   ├── js/app.js
│   └── index.html
├── docker/init.sql       # DB Initialisierung
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

*Entwickelt für OÖ MOKI – Mobile Kinderkrankenpflege OÖ*
 
