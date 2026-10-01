# Zesty 220 Likes — Cloudflare Workers + GitHub Auto Deploy

Production-ready Cloudflare Worker with a professional web UI, Cloudflare Turnstile verification, server-side upstream API calls, and static assets.

## GitHub → Cloudflare automatic deployment

This repository is designed for **Cloudflare Workers Builds**. You do not need the Cloudflare static-file uploader and you do not need a GitHub Actions workflow.

### 1. Upload this folder to a GitHub repository

Keep the repository **private** — runtime credentials must never be committed to Git.

### 2. Connect GitHub in Cloudflare

Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Import a repository** → select this GitHub repository → select the `main` branch → deploy.

If you already created the Worker, open it → **Settings → Builds → Connect** and select this repository.

Workers Builds settings:
- Build command: *(leave empty)*
- Deploy command: `npx wrangler deploy`
- Root directory: `/`
- Production branch: `main`

Every push to `main` will deploy automatically.

## Required runtime secrets

Set these once in the Cloudflare Dashboard. **Do not commit them to Git.**

**Worker → Settings → Variables and Secrets → Add secret**

| Secret name        | Value                                  |
|--------------------|----------------------------------------|
| `TURNSTILE_SECRET` | `0x4AAAAAAFLICCXoXBACekHvukmgiMglL`    |
| `LIKE_API_KEY`     | `SulavOp`                              |

The public Turnstile site key (`0x4AAAAAAFLICIokx6zHNpTP`) is already in `wrangler.jsonc` under `vars` — this is intentional, it is browser-visible by design.

## Worker API

| Route          | Method | Description                                       |
|----------------|--------|---------------------------------------------------|
| `GET /health`  | GET    | Health check — returns `{ ok: true }`             |
| `POST /api/like` | POST | Sends likes after Turnstile verification          |

### POST /api/like — request body

```json
{
  "uid": "123456789",
  "region": "BD",
  "turnstileToken": "<token from frontend>"
}
```

Allowed regions: `BD`, `PK`, `SG`, `ID`, `ME`, `VN`, `TH`, `TW`, `EU`, `RU`

## Important

Use **Import a repository / Workers Builds** — not the "Upload and deploy" static uploader. Cloudflare runs `npx wrangler deploy`, which deploys both the Worker code and `public/` assets together.
