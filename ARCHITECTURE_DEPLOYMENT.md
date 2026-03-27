# ScratchBox.Media Architecture & Deployment Guide

This document explains the website architecture and the deployment steps for a Linux VPS on Hostinger.

## Architecture Overview

### Summary
- Static multi-page site built with Eleventy (11ty)
- Shared layout and footer across pages
- Global CSS/JS assets
- Real URLs for each page (good for SEO and sharing)
- Backend serves the built site (`_site`) so frontend and API share the same origin

### Key Directories
- `src/` contains all source templates and content
- `src/_includes/` contains layout and partials
- `src/assets/` contains global CSS and JS
- `backend/` contains the API + admin logic (Express + MongoDB)
- `_site/` is the build output (generated)

### Pages
Each page is a standalone URL and content file:
- `src/index.njk`
- `src/about/index.njk`
- `src/services/index.njk`
- `src/work/index.njk`
- `src/products/index.njk`
- `src/pricing/index.njk`
- `src/contact/index.njk`
- `src/admin/index.njk`

### Layout & Partials
- Base layout: `src/_includes/layouts/base.njk`
  - Includes the `<head>` metadata
  - Global modals (Calendly, video, project planner, work modal)
  - Navigation and mobile menu
  - Injects page content via `{{ content | safe }}`
- Shared footer: `src/_includes/partials/footer.njk`
  - Included on every page

### Global Assets
- CSS: `src/assets/css/site.css`
- JS: `src/assets/js/site.js`

### Data & SEO
- Site data: `src/_data/site.json`
- Sitemap data: `src/_data/sitemap.json`
- Sitemap template: `src/sitemap.xml.njk`

### Build System
- Eleventy config: `.eleventy.js`
- Build scripts: `package.json`
- Output directory: `_site/`

---

## Deployment (Hostinger Linux VPS)

### Deployment Method (Git Only)
We will deploy using Git (recommended and required for this setup).

Clone the repo on the server:
```bash
cd /var/www
git clone YOUR_REPO_URL scratchbox
cd scratchbox
```

### Prerequisites
- SSH access to your VPS
- A domain pointing to the VPS IP
- MongoDB connection string

### 1) SSH into your server
```bash
ssh root@YOUR_SERVER_IP
```

### 2) Install Node.js 18 with NVM
```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
node -v
```

### 3) Clone the project
```bash
cd /var/www
git clone YOUR_REPO_URL scratchbox
cd scratchbox
```

### 4) Configure backend env
Create `backend/.env`:
```
MONGODB_URI=your_mongodb_connection
PORT=8081
ALLOWED_ORIGINS=https://yourdomain.com
ADMIN_USER=admin
ADMIN_PASS=your_strong_password
```

### 5) Install dependencies
```bash
npm install
```

### 6) Install PM2 and start production
```bash
npm install -g pm2
npm run serve:prod
pm2 save
pm2 startup
```

### 7) Nginx reverse proxy (recommended)
```bash
apt update
apt install nginx -y
```

Create config:
```bash
nano /etc/nginx/sites-available/scratchbox
```

Paste:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable and restart:
```bash
ln -s /etc/nginx/sites-available/scratchbox /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### 8) Enable SSL (recommended)
```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## Notes
- Always run builds with Node 18+ (Eleventy 3.x requirement)
- The backend serves `_site` so frontend and API share the same origin
- Admin panel URL in production: `https://yourdomain.com/adminAccess`
- For updates, run `./deploy.sh` on the server
