# ScratchBox Backend

## Setup
1. Copy `.env.example` to `.env`
2. Set `MONGODB_URI` to your MongoDB connection string
3. Set `ADMIN_USER` and `ADMIN_PASS` for the admin dashboard login
3. (Optional) Set `ALLOWED_ORIGINS` to your live domain, e.g. `https://scratchbox.media`

## Run
```bash
npm install
npm run start
```

## Endpoints
- `POST /api/contact` — contact form submissions
- `POST /api/project` — project form submissions
- `GET /adminAccess` — admin dashboard (login required)

Submissions are stored in MongoDB collection: `SBM-SiteData`.
