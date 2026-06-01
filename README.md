# SME API — Backend Server

Backend API server for the **Sasnaka SME (Sri Lanka Mathematical Examination)** platform. It handles candidate registration sync, admin panel management, exam index number generation, QR code generation, WhatsApp notifications, real-time dashboard updates via WebSocket, and scheduled data jobs.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Running Locally](#running-locally)
- [API Routes](#api-routes)
- [Scheduled Jobs](#scheduled-jobs)
- [Branch Naming Strategy](#branch-naming-strategy)
- [Deployment](#deployment)

---

## Architecture Overview

The server runs as **two concurrent processes**:

| Process | Port | Purpose |
|---|---|---|
| `index.js` (Main) | `3001` | REST API + Scheduler |
| `server.js` (Child) | `3002` | Webhook receiver + WebSocket (Dashboard) |

`index.js` spawns `server.js` as a child process at startup, allowing the webhook/WebSocket server to run independently alongside the main API.

---

## Tech Stack

| Category | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB (Mongoose) |
| Data Source | Google Sheets API (`google-spreadsheet`) |
| Scheduling | `node-cron` |
| Real-time | WebSocket (`ws`) |
| Auth | JWT (`jsonwebtoken`), `bcryptjs` |
| Notifications | Twilio (WhatsApp), Nodemailer, Azure Email |
| QR Codes | `qrcode`, `sharp`, `pdfkit` |
| AI | OpenAI |
| Monitoring | New Relic |

---

## Project Structure

```
sme-api/
├── index.js              # Main server entry point (REST API + scheduler)
├── server.js             # Webhook & WebSocket server (child process)
├── scheduler.js          # Cron job definitions (legacy root-level)
├── scheduler/            # Modular scheduler tasks
├── routes/               # Express route handlers
│   ├── adminRoutes.js
│   ├── authRoutes.js
│   ├── candidateRoutes.js
│   ├── qrCodeRoutes.js
│   └── resultRoutes.js
├── models/               # Mongoose models
│   └── Candidate.js
├── services/             # Business logic & integrations
│   ├── dashboardWebSocket.js
│   ├── emailService.js
│   ├── indexNumberGenerator.js
│   ├── mongoConnectionPool.js
│   ├── resultSheetService.js
│   └── velocityCalculator.js
├── middleware/           # Express middleware (auth, etc.)
├── fetch_data/           # Google Sheets data-fetch logic
├── exams_actions/        # Exam-related operations
├── config/               # App configuration (env, db, etc.)
├── utils/                # Shared utility functions
├── scripts/              # One-off / admin scripts
├── api/                  # Additional API handlers
├── tests/                # Test files
└── output/               # Generated output files (QR codes, PDFs)
```

---

## Getting Started

### Prerequisites

- Node.js `v18+`
- MongoDB instance (local or Atlas)
- Google Cloud service account with Sheets API enabled
- (Optional) Twilio account for WhatsApp notifications

### Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `PORT` | Main API server port (default: `3001`) |
| `WEBSOCKET_PORT` | WebSocket server port (default: `3002`) |
| `JWT_SECRET` | Secret key for JWT token signing |
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB` | MongoDB database name |
| `MONGODB_COLLECTION` | Registrations collection name |
| `ADMIN_MONGODB_COLLECTION` | Admin panel collection name |
| `SHEET_ID` | Primary Google Sheet ID (candidates) |
| `ADMIN_SHEET_ID` | Admin panel Google Sheet ID |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Path to Google service account JSON |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_WHATSAPP_NUMBER` | Twilio WhatsApp sender number |
| `AZURE_EMAIL_ENDPOINT` | Azure Communication Services endpoint |
| `AZURE_EMAIL_API_KEY` | Azure Email API key |
| `NEW_RELIC_LICENSE_KEY` | New Relic license key |

> **Never commit `.env` or any credentials to version control.**

### Running Locally

```bash
# Install dependencies
npm install

# Development (with auto-reload)
npm run dev

# Production
npm start
```

---

## API Routes

| Method | Route | Description |
|---|---|---|
| `*` | `/api/admin/*` | Admin panel operations |
| `*` | `/api/auth/*` | Authentication (login, JWT) |
| `*` | `/api/candidate/*` | Candidate data & management |
| `*` | `/api/qrcode/*` | QR code generation & retrieval |
| `*` | `/api/results/*` | Exam results operations |
| `POST` | `/api/webhook/new-registration` | Webhook from Google Apps Script (port 3002) |

---

## Scheduled Jobs

Jobs are initialised by `initScheduler()` on server start and also run **once immediately** at startup:

| Job | Schedule | Description |
|---|---|---|
| `cleanCollection()` & `cleanAdminCollection()` | Daily at **00:00** | Remove duplicate documents from MongoDB |
| `syncData()` & `syncAdminData()` | Daily at **00:30** | Sync candidates & admin data from Google Sheets |
| Index number & QR code generation | Daily at **01:00** | Generate exam index numbers and QR codes for eligible candidates |

---

## Branch Naming Strategy

All branches follow a consistent naming convention to keep the repository organised and easy to navigate.

### Format

```
<type>/<author-or-scope>-<short-description>
```

### Branch Types

| Type | Purpose | Example |
|---|---|---|
| `feat/` | New feature development | `feat/seniru-qr-generation` |
| `fix/` | Bug fixes | `fix/seniru-duplicate-nic-cleanup` |
| `chore/` | Maintenance, config, dependency updates | `chore/update-dependencies` |
| `refactor/` | Code restructuring without behaviour change | `refactor/scheduler-modularise` |
| `docs/` | Documentation changes | `docs/api-route-list` |
| `test/` | Adding or updating tests | `test/candidate-sync-unit` |
| `hotfix/` | Urgent production fixes | `hotfix/webhook-crash` |

### Protected Branches

| Branch | Purpose |
|---|---|
| `main` | Production-ready code. Direct pushes are **not allowed**. |
| `develop` | Integration branch. All features are merged here first. |

### Rules

- Branch off from `develop` for all feature and fix branches.
- Merge into `develop` via **Pull Request** with at least one reviewer.
- Only `develop` → `main` merges go to production.
- Delete branches after they are merged.
- Keep branch names **lowercase**, use **hyphens** (not underscores or spaces).

### Example Workflow

```bash
# Create a new feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feat/seniru-exam-index-generation

# ... do your work ...

git add .
git commit -m "feat: add exam index number generation service"
git push origin feat/seniru-exam-index-generation

# Open a Pull Request → develop
```

---

## Deployment

The API supports multiple deployment targets:

| Target | Config File | Notes |
|---|---|---|
| **Render** | `render.yaml` | Primary cloud deployment |
| **Azure App Service** | `web.config` | Alternative target |
| **Heroku** | `Procfile` | Legacy support |
| **Docker** | `Dockerfile` | Container-based deployment |

For Render deployment, environment variables should be configured in the Render dashboard. Do **not** use `.env` files in production.
