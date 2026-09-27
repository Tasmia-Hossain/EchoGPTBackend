# EchoGPT Backend

Production-ready backend for the EchoGPT Chrome Extension, built with NestJS, PostgreSQL, and Prisma.

## Features
Authentication (JWT + refresh token rotation), User Management, Role-Based
Access Control (Admin/User), Subscription Management (Free/Premium + usage
limits), AI Provider Management (OpenAI/Anthropic/Gemini with encrypted API
keys), Chat API with conversation history, Web Search API, Admin Dashboard
(stats, usage analytics, request logs, system health), full Swagger/OpenAPI
documentation.

## Tech Stack
NestJS, PostgreSQL, Prisma ORM, Swagger/OpenAPI, JWT + Passport, bcrypt,
AES-256-GCM (API key encryption).

## Setup

1. Install dependencies:
```bash
   npm install
```

2. Create `.env` from the template:
```bash
   cp .env.example .env
```
   Fill in:
   - `DATABASE_URL` — your PostgreSQL connection string
   - `JWT_SECRET`, `JWT_REFRESH_SECRET` — random strings, minimum 32 characters each
   - `AI_PROVIDER_ENCRYPTION_KEY` — must be exactly 32 bytes
   - `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` — optional, only needed to actually call those providers

3. Run database migrations:
```bash
   npx prisma migrate deploy
   npx prisma generate
```

4. Seed roles and an admin account:
```bash
   npm run build
   node dist/scripts/seed.js
```
   This creates `USER`/`ADMIN` roles and an admin user
   (`admin@echogpt.dev` / `Admin123!Change` — change this password after first login).

5. Start the server:
```bash
   npm run start:dev
```

6. API docs: http://localhost:3000/api/docs

## Testing
```bash
npm test        # unit tests
npm run test:e2e
```

## Database
See `docs/database-architecture.md` for the full schema breakdown.