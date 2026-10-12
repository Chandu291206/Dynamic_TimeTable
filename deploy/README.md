# Direct Production Deployment Guide (No Docker)

This guide documents how to deploy the Timetable Management System directly to bare-metal or virtual private servers (VPS) without Docker or containerization.

## Architecture

```text
Internet
   │
   ▼ HTTPS (443)
Nginx (Reverse Proxy & Static Web Server)
   │
   ├── /        → Serves compiled React static assets (/var/www/timetable/frontend/dist)
   │
   └── /api     → Reverse proxies to Node.js / Express backend (http://127.0.0.1:5000)
                     │
                     ▼
                 PostgreSQL (Native database service)
```

---

## 1. Server Prerequisites

On Debian/Ubuntu 22.04 LTS or 24.04 LTS:

```bash
# 1. Update packages
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20+ LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# 4. Install Nginx and Certbot (for SSL)
sudo apt install -y nginx certbot python3-certbot-nginx

# 5. (Optional) Install PM2 globally
sudo npm install -g pm2
```

---

## 2. Database Configuration

```bash
# Switch to postgres user
sudo -u postgres psql

# Run inside PostgreSQL prompt:
CREATE DATABASE timetable_db;
CREATE USER timetable_user WITH ENCRYPTED PASSWORD 'your_strong_db_password';
GRANT ALL PRIVILEGES ON DATABASE timetable_db TO timetable_user;
\q
```

---

## 3. Application Setup

```bash
# Clone the repository to /var/www/timetable
sudo mkdir -p /var/www/timetable
sudo chown -R $USER:$USER /var/www/timetable
git clone https://github.com/your-org/timetable-management.git /var/www/timetable
cd /var/www/timetable

# Configure production environment
cp backend/.env.production.example backend/.env
chmod 600 backend/.env
nano backend/.env
```

Ensure the following variables are configured in `backend/.env`:
- `DATABASE_URL`: `postgresql://timetable_user:your_strong_db_password@localhost:5432/timetable_db?schema=public`
- `JWT_SECRET`: 32+ characters cryptographically secure secret (generate with `openssl rand -base64 36`)
- `NODE_ENV`: `production`
- `FRONTEND_URL`: `https://timetable.your-domain.edu`

---

## 4. Build and Database Migrations

```bash
# Backend setup
cd /var/www/timetable/backend
npm ci --omit=dev
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed  # Seeds initial classes, subjects, faculty, CR, and admin

# Frontend build
cd /var/www/timetable/frontend
npm ci
npm run build
```

---

## 5. Node.js Process Management

### Option A: Using PM2 (Recommended)

```bash
cd /var/www/timetable
pm2 start deploy/pm2/ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

### Option B: Using systemd

```bash
sudo cp deploy/systemd/timetable-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable timetable-backend
sudo systemctl start timetable-backend
sudo systemctl status timetable-backend
```

---

## 6. Nginx Web Server Configuration

```bash
# Copy Nginx configuration
sudo cp deploy/nginx/timetable.conf /etc/nginx/sites-available/timetable.conf

# Update domain name inside the configuration
sudo sed -i 's/timetable.your-domain.edu/your-actual-domain.edu/g' /etc/nginx/sites-available/timetable.conf

# Enable site
sudo ln -s /etc/nginx/sites-available/timetable.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Verify and reload Nginx
sudo nginx -t
sudo systemctl reload nginx

# Obtain free Let's Encrypt SSL certificate
sudo certbot --nginx -d your-actual-domain.edu
```

---

## 7. Log Rotation Setup

Install the log rotation configuration to prevent disk space exhaustion:

```bash
sudo cp deploy/logrotate/timetable.conf /etc/logrotate.d/timetable
sudo chmod 644 /etc/logrotate.d/timetable

# Test the logrotate configuration
sudo logrotate -d /etc/logrotate.d/timetable
```

---

## 8. Health & Error Monitoring

- **Active Health Endpoint**:
  ```bash
  curl -sSf http://127.0.0.1:5000/api/health
  ```
  Returns process uptime, RSS memory, and verified PostgreSQL database connectivity (`{"status":"ok","database":"connected",...}`).
  Returns HTTP 503 if the database becomes unreachable.

- **Structured Logging**:
  In production, unhandled 5xx exceptions emit structured JSON records with timestamps, request path, status, and stack traces to stderr for automatic capture by PM2, systemd, or centralized log collectors (Prometheus / Datadog / ELK).

---

## 9. Database Backup & Disaster Recovery

Automate daily database backups with 14-day retention:

```bash
# Set up daily cron job (runs at 02:00 AM)
crontab -e
# Add:
0 2 * * * /var/www/timetable/deploy/backup/backup.sh >> /var/log/timetable/backup.log 2>&1
```

For manual backup, restore, and verification drills, see the [Database Backup Guide](file:///c:/3rd/year/Timetable/deploy/backup/README.md).

---

## 10. Verification

Verify the live deployment:
```bash
# Check API health
curl -sSf http://127.0.0.1:5000/api/health

# Check public endpoint
curl -sSf http://127.0.0.1:5000/api/classes

# Check backend status
pm2 status
```
