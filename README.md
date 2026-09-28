# EchoGPT Backend

Backend REST API for the EchoGPT Chrome Extension, built with NestJS, PostgreSQL, and Prisma.

## Features

- Authentication with access JWTs and rotating refresh tokens
- User profiles and role-based access control
- Free and Premium subscriptions with request limits
- Admin-managed OpenAI, Anthropic, and Gemini providers
- Encrypted AI provider API keys
- Chat conversations and message history
- Wikipedia-backed web search and per-user search history
- Admin dashboard, usage analytics, request logs, and health endpoint
- Swagger/OpenAPI documentation

## Technology stack

- NestJS and TypeScript
- PostgreSQL and Prisma ORM
- Swagger/OpenAPI
- Passport JWT
- bcrypt password hashing
- AES-256-GCM encryption for provider API keys

## Prerequisites

- Node.js compatible with the installed NestJS and Prisma versions
- npm
- A running PostgreSQL database

## Environment configuration

Copy `.env.example` to `.env`, then set the database connection and generate new secrets. Do not use the example secret values outside local setup.

Required variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Signs access tokens; at least 32 characters |
| `JWT_EXPIRES_IN` | Access-token lifetime, such as `15m` |
| `JWT_REFRESH_SECRET` | Signs refresh tokens; use a different secret of at least 32 characters |
| `JWT_REFRESH_EXPIRES_IN` | Refresh-token lifetime, such as `7d` |
| `AI_PROVIDER_ENCRYPTION_KEY` | Exactly 32 printable ASCII characters (32 UTF-8 bytes) |
| `PORT` | HTTP port, for example `3000` |
| `CORS_ORIGINS` | Comma-separated exact trusted origins, for example `http://localhost:3000` |

`NODE_ENV` is optional and can be `development`, `test`, or `production`. The provider API key variables in `.env.example` are optional; provider keys can be configured through the admin provider API.

Outbound AI-provider and Wikipedia requests have a fixed 30-second timeout (`EXTERNAL_HTTP_TIMEOUT_MS` in `src/config/external-http.constants.ts`). Provider errors and timeout details are returned to clients as generic service-unavailable responses.

`CORS_ORIGINS` accepts multiple origins separated by commas. Entries are trimmed and empty entries are ignored. Configure only trusted frontend or browser-extension origins in production. For a Chrome extension, use its actual origin in the form `chrome-extension://<extension-id>`; obtain the ID from the installed or unpacked extension rather than assuming a production ID. Swagger is served from the API origin at `/api/docs`, so same-origin access does not require another CORS entry.

Generate suitable local secret values with Node.js:

    node -e "const c=require('crypto'); console.log('JWT_SECRET='+c.randomBytes(32).toString('hex')); console.log('JWT_REFRESH_SECRET='+c.randomBytes(32).toString('hex')); console.log('AI_PROVIDER_ENCRYPTION_KEY='+c.randomBytes(24).toString('base64url'))"

Copy the generated values into `.env`. The encryption-key command produces 32 printable characters. Keep the encryption key stable after provider keys have been stored; changing it prevents the application from decrypting those stored keys.

## Installation

    npm install

## Database setup

Create the PostgreSQL database, configure `DATABASE_URL`, and apply migrations:

    npx prisma migrate deploy
    npx prisma generate

Configure `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in your local `.env` before seeding. Use an email address for the admin account and a unique password of at least 16 characters. These variables are required only by the seed script, not by normal application startup. Never commit your `.env` file.

Seed roles and the admin account:

    npm run build
    node dist/scripts/seed.js

The seed script creates or updates the admin password from `SEED_ADMIN_PASSWORD`, assigns the `ADMIN` role, and creates a Premium subscription if the admin has no subscription. It does not print the password. Running it again is safe; the configured password is applied to the seeded admin account each time.

## Run the application

Development:

    npm run start:dev

Build and production start:

    npm run build
    npm run start:prod

Swagger UI is available at:

    http://localhost:3000/api/docs

Use the configured `PORT` value if it is not `3000`.

## API overview

- Authentication: `/auth`
- Profiles and admin endpoints: `/users`
- Subscription and usage: `/subscriptions`
- AI provider management: `/ai-providers`
- Chat and conversations: `/chat`
- Search and search history: `/search`

Most application endpoints require a bearer access token. Admin endpoints require the `ADMIN` role.

## Tests

    npm test
    npm run test:e2e

## Database documentation

See [docs/database-architecture.md](docs/database-architecture.md) for the schema overview.
