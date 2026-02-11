# Simple SIEM (NestJS + MongoDB)

## Setup

1. Install dependencies

```
npm install
```

2. Start MongoDB (local)

```
# Default connection in src/app.module.ts
mongodb://localhost:27017/simple-siem
```

3. Run the server

```
npm run start:dev
```

API base: `http://localhost:3000/api`

## Endpoints

- `POST /api/logs`
- `GET /api/alerts`

## Example log payload

```
{
  "timestamp": "2026-02-09T19:00:00.000Z",
  "source": "auth-service",
  "severity": "high",
  "event": "login_failed",
  "user": "alice",
  "ip": "203.0.113.10"
}
```
