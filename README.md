<p align="center">
  <img src="./docs/animated-logo.svg" width="200" alt="Smart Lost & Found Logo" />
</p>

# Smart Lost & Found Management System

**SEUSL Group Project**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node version](https://img.shields.io/badge/node-22.x-blue.svg)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/database-MongoDB-green.svg)](https://www.mongodb.com)
[![Redis](https://img.shields.io/badge/cache-Redis-red.svg)](https://redis.io)

## 👥 Team Members

| Nisala | Dinuka | Heshan | Janidu |
|:---:|:---:|:---:|:---:|
| <a href="https://github.com/nisalajurianze"><img src="https://github.com/nisalajurianze.png" width="100" style="border-radius:50%" alt="Nisala" /></a> | <a href="https://github.com/dinukahansana"><img src="https://github.com/dinukahansana.png" width="100" style="border-radius:50%" alt="Dinuka" /></a> | <a href="https://github.com/Heshan-3"><img src="https://github.com/Heshan-3.png" width="100" style="border-radius:50%" alt="Heshan" /></a> | <a href="https://github.com/janidu200301"><img src="https://github.com/janidu200301.png" width="100" style="border-radius:50%" alt="Janidu" /></a> |
| [@nisalajurianze](https://github.com/nisalajurianze) | [@dinukahansana](https://github.com/dinukahansana) | [@Heshan-3](https://github.com/Heshan-3) | [@janidu200301](https://github.com/janidu200301) |

An AI-powered web platform designed to streamline and automate the reporting, matching, and recovery of lost and found items within a university campus. Built on the MERN stack (MongoDB, Express, React, Node.js) with real-time Socket.io notifications, Redis caching, Cloudinary media storage, and image-based tag heuristics.

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Objectives](#3-objectives)
4. [System Architecture](#4-system-architecture)
5. [Key Features](#5-key-features)
6. [Folder Structure](#6-folder-structure)
7. [User Roles and Permissions](#7-user-roles-and-permissions)
8. [Database Models Summary](#8-database-models-summary)
9. [API Endpoints Reference](#9-api-endpoints-reference)
10. [Prerequisites & Dependencies](#10-prerequisites--dependencies)
11. [Environment Variables](#11-environment-variables)
12. [Installation Guide](#12-installation-guide)
13. [Database Seeder & Initial Run](#13-database-seeder--initial-run)
14. [Local Execution (Without Docker)](#14-local-execution-without-docker)
15. [Dockerized Local Execution](#15-dockerized-local-execution)
16. [Security Implementation](#16-security-implementation)
17. [Caching & Performance Strategy](#17-caching--performance-strategy)
18. [AI Matching and Heuristics](#18-ai-matching-and-heuristics)
19. [Email Templates and Services](#19-email-templates-and-services)
20. [Real-time Events (WebSockets)](#20-real-time-events-websockets)
21. [Postman Collection Usage](#21-postman-collection-usage)
22. [Front-end Layout Design](#22-front-end-layout-design)
23. [Theme Customisation (Light/Dark)](#23-theme-customisation-lightdark)
24. [Cloudinary Integration](#24-cloudinary-integration)
25. [CI/CD Pipeline Workflow](#25-cicd-pipeline-workflow)
26. [Troubleshooting Guide](#26-troubleshooting-guide)
27. [Deployment Instructions](#27-deployment-instructions)
28. [Future Scope](#28-future-scope)
29. [Academic Disclaimer](#29-academic-disclaimer)
30. [License](#30-license)

---

## 1. Project Overview
The **Smart Lost & Found Management System** is a university-centric application designed to digitise paper-based or group-chat-based lost and found records. The system utilizes text search indexation, category tags, and matching heuristics to correlate lost and found items. When a high-probability match is found, notifications are pushed to both users via in-app alerts, WebSockets, and HTML emails.

---

## 2. Problem Statement
Traditional university lost and found divisions suffer from several operational issues:
- Paper logbooks are difficult to search.
- Communication with student claimants is slow.
- High volume of duplicate item queries.
- Lack of security logging and audit trail verification for expensive items.
- Low recovery rates due to fragmentation (WhatsApp groups, Facebook posts, department noticeboards).

---

## 3. Objectives
- Centralise campus lost and found reports.
- Implement an AI-ready matching service with weighted similarity scoring.
- Ensure real-time notification push on matching items.
- Provide a secure, audit-logged admin control room for claim verifications.
- Maintain high system performance using Redis query caching and DB indexing.

---

## 4. System Architecture
```
  ┌───────────────────────────────────────────────────────────┐
  │                        FRONT-END                          │
  │              React / Vite / Redux / Tailwind              │
  └─────────────────────────────┬─────────────────────────────┘
                                │ HTTP / JSON / WebSockets
                                ▼
  ┌───────────────────────────────────────────────────────────┐
  │                        BACK-END                           │
  │                  Express / Node.js Server                 │
  └──────────────┬──────────────────────────────┬─────────────┘
                 │                              │
                 ▼                              ▼
  ┌─────────────────────────────┐┌────────────────────────────┐
  │          DATABASE           ││          CACHING           │
  │           MongoDB           ││           Redis            │
  └─────────────────────────────┘└────────────────────────────┘
```

---

## 5. Key Features
- **User Authentication**: Secure JWT cookies session-refresh.
- **Reporting Forms**: Drag-and-drop Image Upload.
- **AI Matching**: Matches Lost & Found items based on location, title tags, categories, and descriptions.
- **Verification System**: Proof uploads and description review dialogs.
- **Admin Control Room**: User status suspension toggles, item catalog moderation, category configuration.
- **Audit Logging**: Traceable admin activities.
- **Redis Cache Layer**: In-memory caching for statistical compiles.
- **Graceful Degradation**: Fallback rules if third-party services (Redis, Cloudinary) go offline.
- **Light/Dark Mode**: High contrast dark charm style.
- **Responsive Layout**: Designed for mobile and desktop screens.

---

## 6. Folder Structure
```
Smart-lost-found-system/
│
├── README.md                           # Main Documentation
├── docker-compose.yml                  # Local Container Orchestration
├── .dockerignore                       # Docker exclusion file
│
├── backend\
│   ├── package.json                    # Backend Dependencies
│   ├── server.js                       # Express Application Entry
│   ├── config\                         # DB, Socket, Redis & Cloudinary configs
│   ├── controllers\                    # Business Logic Controllers
│   ├── models\                         # Mongoose Database Schemas
│   ├── routes\                         # API Routers mapping endpoints
│   ├── middlewares\                    # Security, uploads, & validation middlewares
│   ├── services\                       # Cloudinary, Email, Sockets & AI matching
│   └── seed\                           # Database Seeder file
│
└── frontend\
    ├── package.json                    # Frontend Dependencies
    ├── tailwind.config.js              # Styling Framework rules
    ├── index.html                      # DOM Entry
    └── src\
        ├── main.jsx                    # React Entry
        ├── App.jsx                     # Route Mapping Engine
        ├── components\                 # Common components, layouts, cards & charts
        ├── pages\                      # Public, User and Admin Panels
        ├── redux\                      # Redux Toolkit Slices
        ├── services\                   # Backend HTTP API Client integrations
        └── hooks\                      # Custom hooks (Auth, Socket, Debounce)
```

---

## 7. User Roles and Permissions
| Permission / Role | Guest | Registered User | Administrator |
|--------------------|:-----:|:---------------:|:-------------:|
| View public listings |  ✅  |       ✅       |      ✅      |
| Report Lost/Found  |  ❌  |       ✅       |      ✅      |
| View Match alerts  |  ❌  |       ✅       |      ✅      |
| Submit Claim       |  ❌  |       ✅       |      ✅      |
| Deactivate Users   |  ❌  |       ❌       |      ✅      |
| Review Claims      |  ❌  |       ❌       |      ✅      |
| Add Categories     |  ❌  |       ❌       |      ✅      |
| View Audit Logs    |  ❌  |       ❌       |      ✅      |

---

## 8. Database Models Summary
Core MongoDB models defined with Mongoose
1. **User**: Credentials, profiles, activation states.
2. **LostItem**: User ID, locations, dates, descriptions, categories.
3. **FoundItem**: Finder ID, storage location, categories, tag attributes.
4. **Match**: Relates `LostItem` and `FoundItem` with similarity scores.
5. **ClaimRequest**: Claimant details, descriptions, status checks.
6. **Notification**: User inbox alerts, delivery states.
7. **Feedback**: Rating star evaluations, administrator replies.
8. **AdminLog**: Track actions for security auditing.
9. **ImageAnalysis**: Meta tag outputs from image uploads.
10. **Category**: Category name labels and emojis.

---

## 9. API Endpoints Reference

### Authentication
- `POST /api/auth/register` - Create user account
- `POST /api/auth/login` - Authenticate credentials, set cookie tokens
- `POST /api/auth/logout` - Clear cookie sessions
- `GET /api/auth/me` - Fetch profile of active user
- `GET /api/auth/csrf` - Issue a CSRF token for requests that change data
- `POST /api/auth/forgot-password` - Request reset tokens
- `POST /api/auth/reset-password` - Reset credentials

### Items & Reporting
- `POST /api/lost-items` - Create lost report
- `GET /api/lost-items` - Paginated lost reports
- `POST /api/found-items` - Create found listing
- `GET /api/found-items` - Paginated found items

### Claims & Matches
- `POST /api/claims` - Create ownership claim
- `PUT /api/claims/:id/review` - (Admin) Approve or reject a claim with a remark
- `GET /api/matches` - Fetch potential match suggestions

### Admin Panels
- `GET /api/admin/stats` - Gather compilation analytics
- `GET /api/admin/users` - Paginated user listings
- `PUT /api/admin/users/:id/status` - Toggle user activation

---

## 10. Prerequisites & Dependencies

- **Node.js** 22.x, at least 22.12
- **MongoDB** 7 replica set for transaction-backed workflows
- **Redis** 7 or newer for the production profile
- **Git** and, for the container setup, **Docker Engine with the Compose plugin**
- **Cloudinary** and **Resend or SMTP** for production media and transactional email

---

## 11. Environment Variables

Copy [`backend/.env.example`](./backend/.env.example) to `backend/.env` for manual development. Set a random `JWT_ACCESS_SECRET` of at least 32 characters and point `MONGO_URI` to your MongoDB replica set. Set `CLIENT_URLS=http://localhost:3000` for the Vite development server at its default port.

Use [`frontend/.env.example`](./frontend/.env.example) when overriding frontend settings. The default `/api` path and current-origin Socket.IO URL work with the local Vite proxy.

Configure provider credentials only in local environment files or the production secret manager. See [AI provider routing](./docs/implementation/AI_PROVIDER_ROUTING.md) for independent chat and vision configuration.

---

## 12. Installation Guide

```bash
git clone https://github.com/nisalajurianze/Smart-lost-found-system.git
cd Smart-lost-found-system
npm ci --prefix backend
npm ci --prefix frontend
```

For Docker, follow [Dockerized Local Execution](#15-dockerized-local-execution).

---

## 13. Database Seeder & Initial Run

```bash
cd backend
npm run seed:defaults
```

`seed:defaults` adds reference data and preserves existing user data. For a one-time administrator setup, supply `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `CONFIRM_BOOTSTRAP_ADMIN=YES` in the environment, then run `npm run admin:bootstrap`. For an existing installation, follow [MIGRATION.md](./MIGRATION.md) before deployment.

---

## 14. Local Execution (Without Docker)

1. Configure `backend/.env` as described above and start the MongoDB replica set.
2. In one terminal, run `npm run dev --prefix backend` from the project root.
3. In another terminal, run `npm run dev --prefix frontend` from the project root.
4. Open `http://localhost:3000`. Vite proxies `/api` and `/socket.io` to the backend at port 5000.

---

## 15. Dockerized Local Execution

Create a root `.env` with a random `JWT_ACCESS_SECRET` of at least 32 characters and a strong `REDIS_PASSWORD`. From the project root, run:

```bash
docker compose up --build -d --wait
docker compose exec backend npm run seed:defaults
curl --fail http://localhost:3000/api/health/ready
```

Open `http://localhost:3000`. The frontend server proxies the API and Socket.IO routes. MongoDB and Redis run on the internal Compose network.

---

## 16. Security Implementation

- Short-lived access JWT in an HttpOnly cookie
- Hashed refresh tokens with rotation and reuse detection
- Double-submit CSRF protection on requests that change data
- Exact CORS origin allowlist and secure production cookies
- Role-based access control, request validation and rate limits
- Public API responses that redact private contact data
- Authenticated Cloudinary assets and short-lived signed URLs for private claim evidence

See [SECURITY.md](./SECURITY.md) and [OPERATIONS.md](./OPERATIONS.md).

---

## 17. Caching & Performance Strategy
- **Redis Caching**: Cached categories list and admin stats dashboard compiles.
- **MongoDB Indexing**: Speed up lookups using indexed search tags and user IDs.
- **Connection Fallback**: Connection retries cap at 5 attempts; if Redis connection fails, the system bypasses the cache without crashing.

---

## 18. AI Matching and Heuristics
Reports undergo similarity evaluations matching:
- **Category Match**: Direct filter comparison.
- **Location Similarity**: Triggers score matches.
- **Description Matching**: Evaluates keywords and tags (e.g., color, brands, phone models).
- Match notifications depend on the configured matching thresholds.

---

## 19. Email Templates and Services
NodeMailer compiles beautiful HTML templates sent on events:
- User verification emails.
- Password reset links.
- High similarity match alerts.
- Claim submission confirmation.
- Admin review updates (Approvals/Rejections).

---

## 20. Real-time Events (WebSockets)

The server authenticates Socket.IO connections with the access session and joins the user to a private room. The frontend listens for the `notification` event for match and claim updates. Verify the session cookie and realtime connection on the target host before public release.

---

## 21. Postman Collection Usage

Import the [Postman collection](./backend/postman/smart-lost-found.postman_collection.json). Set `baseUrl` to `http://localhost:5000/api` for a direct local backend or `http://localhost:3000/api` through Compose. Run **Get CSRF Token** before requests that change data and keep Postman's cookie jar enabled for login and protected requests.

---

## 22. Front-end Layout Design
- **PublicLayout**: Public home, item listings, about and contact portals.
- **DashboardLayout**: Left-hand sidebar, top bar user drawer, stat grids.
- **AdminLayout**: Admin panel navigation (audit trails, category creations, feedback boards).

---

## 23. Theme Customisation (Light/Dark)
A toggle switch changes CSS configurations:
- **Light Mode**: Off-white layout, slate typography.
- **Dark Mode**: Slate-950 backdrop, indigo accents, glassmorphic cards.

---

## 24. Cloudinary Integration
- Image file uploads are supported through Multer memory storage.
- If credentials are empty, the backend stores item logs and triggers fallbacks, logging warning logs without crashing image-less submissions.

---

## 25. CI/CD Pipeline Workflow

- [Production Verification](./.github/workflows/ci.yml) runs clean installs, lint, unit tests, dependency audits, a frontend build, MongoDB transaction tests and a container authentication smoke test.
- [Security Analysis](./.github/workflows/security.yml) runs CodeQL and secret scanning.
- [Build Release Candidate](./.github/workflows/deploy.yml) builds release images on manual dispatch.

---

## 26. Troubleshooting Guide

- **API readiness** — Check `/api/health/ready` for required dependencies.
- **Login or session errors** — Check `JWT_ACCESS_SECRET`, `CLIENT_URLS`, cookie settings and CSRF handling.
- **Database transaction errors** — Verify that `MONGO_URI` points to a working replica set.
- **Provider errors** — Check the configured Cloudinary, email or AI provider and the backend logs.

---

## 27. Deployment Instructions

Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for the Vercel frontend, Railway backend and same-origin routing. Review [VERIFICATION.md](./VERIFICATION.md) and [Production Certification Status](./PRODUCTION_CERTIFICATION_STATUS.md) for the release checks.

- [Operations guide](./OPERATIONS.md) and [Migration guide](./MIGRATION.md)
- [API reference](./docs/api/openapi.yaml) and [Project completion matrix](./PROJECT_COMPLETION_MATRIX.md)
- [AI capability matrix](./docs/implementation/AI_PLATFORM_CAPABILITY_MATRIX_2026.md) and [AI provider routing](./docs/implementation/AI_PROVIDER_ROUTING.md)
- [Credential rotation](./SECURITY_ROTATION_REQUIRED.md) and [Production approval checklist](./docs/governance/PRODUCTION_APPROVAL_CHECKLIST.md)

---

## 28. Future Scope
- **QR Code integration**: Printable QR tags for belongings.
- **Mobile app companion**: React Native integration.
- **Face recognition search**: Match key profile details.

---

## 29. Academic Disclaimer
This project is developed as a course project submission for software engineering curriculum requirements. It is a simulated environment intended for educational demonstrations.

---

## 30. License
Distributed under the MIT License. See [LICENSE](./LICENSE) for more information.
