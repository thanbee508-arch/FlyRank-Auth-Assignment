# Auth API — Login & Protect

A secure Express API that handles user authentication — **sign up, log in, log out** — and protects routes so they answer only for logged-in users. [Supabase Auth](https://supabase.com/docs/guides/auth) is the Identity Provider: it stores accounts, hashes passwords, and signs the JSON Web Tokens. This server never touches a password store or a hashing function — it forwards credentials to Supabase and **verifies the tokens Supabase hands back** before opening any protected door.

## How it works — the trust triangle

1. The client sends credentials to Supabase (through `POST /auth/signup` / `POST /auth/login`).
2. Supabase checks them and returns a signed JWT (the `access_token`).
3. The client calls this API with `Authorization: Bearer <token>`.
4. A single `requireAuth` middleware asks Supabase `auth.getUser(token)` — real verification, not a local guess — and attaches the verified user to the request. Invalid, tampered, or expired tokens are refused with `401`.

## Stack

- **Node.js ≥ 20** with **Express 5**
- **@supabase/supabase-js** — Supabase Auth SDK (signUp, signInWithPassword, getUser, signOut)
- **dotenv** — loads git-ignored secrets from `.env`
- **swagger-ui-express** — interactive docs with bearer auth at `/docs`
- **node:test + supertest** — integration tests against a faked Supabase client (no network needed)

## Setup

### 1. Create a free Supabase project

1. Sign up at [supabase.com](https://supabase.com) (free, no card) and create a new project.
2. In the dashboard, open **Project Settings → API** and copy the **Project URL** and the **anon key**. Only the anon key is used here — never the `service_role` key, which bypasses all security.
3. For this practice project, open **Authentication → Sign In / Providers → Email** and turn **"Confirm email" off**, so a fresh signup can log in immediately. (In production you would leave it on.)

### 2. Configure the environment

```bash
cp .env.example .env
```

Fill in your values:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your-anon-key
PORT=3000
```

`.env` is git-ignored and must never be committed.

### 3. Install and run

```bash
npm install
npm start
```

The server logs `Server running on http://localhost:3000` followed by `Connected to Supabase`. Swagger UI is at [http://localhost:3000/docs](http://localhost:3000/docs).

## API reference

| Method | Endpoint               | Auth required                 | Success | Errors                                     |
| ------ | ---------------------- | ----------------------------- | ------- | ------------------------------------------ |
| POST   | `/auth/signup`         | none                          | `201`   | `400` missing/invalid input                |
| POST   | `/auth/login`          | none                          | `200`   | `400` missing input · `401` bad credentials |
| POST   | `/auth/logout`         | `Authorization: Bearer <token>` | `204`   | `401` missing/invalid token                |
| GET    | `/protected/profile`   | `Authorization: Bearer <token>` | `200`   | `401` missing/invalid token                |
| GET    | `/protected/dashboard` | `Authorization: Bearer <token>` | `200`   | `401` missing/invalid token                |
| GET    | `/public/info`         | none                          | `200`   | —                                          |

Every error is JSON: `{ "error": "<message>" }`.

## Swagger UI

Open [http://localhost:3000/docs](http://localhost:3000/docs), click **Authorize**, paste the `access_token` from `/auth/login`, and use **Try it out** on any locked route — no curl needed.

![Swagger UI with bearer-protected routes](docs/swagger-ui.png)

## Try the full flow with curl

```bash
curl -i -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

TOKEN=<paste the access_token from the login response>

curl -i http://localhost:3000/public/info
curl -i http://localhost:3000/protected/profile -H "Authorization: Bearer $TOKEN"
curl -i http://localhost:3000/protected/profile -H "Authorization: Bearer ${TOKEN}x"
curl -i -X POST http://localhost:3000/auth/logout -H "Authorization: Bearer $TOKEN"
```

Expected: `201` → `200` with tokens → `200` public → `200` profile → `401` for the tampered token → `204` logout.

## Tests

```bash
npm test
```

Integration tests cover every endpoint and status code (400/401 validation, tampered tokens, middleware reuse, Swagger's bearer scheme) using a faked Supabase client, so they run offline and never touch your real project.

## Project structure

```
src/
  server.js               boots the app, checks the Supabase connection
  app.js                  wires routes, middleware, Swagger UI
  supabase.js             creates the Supabase client from .env
  middleware/requireAuth.js   the one reusable guard: extracts + verifies bearer tokens
  routes/auth.js          signup, login, logout
  routes/protected.js     profile + dashboard (both behind requireAuth)
  routes/public.js        open endpoint
openapi.json              OpenAPI 3 spec with the bearerAuth security scheme
tests/                    node:test + supertest suite with a faked Supabase client
```

## Security notes

- `.env` is git-ignored; only `.env.example` with placeholders is committed.
- The API uses the **anon key** only — the `service_role` key never appears in this codebase.
- Tokens are verified server-side with `supabase.auth.getUser(token)` on every protected request; nothing is trusted client-side.
