# AegisCode — Production Deployment Architecture

AegisCode is built for cloud deployment across Vercel, Render, and MongoDB Atlas.

---

## 1. Frontend (Vercel)

- **Framework**: Next.js 15+ App Router
- **Root Directory**: `apps/web`
- **Build Command**: `pnpm build`
- **Output Directory**: `.next`
- **Environment Variables**:
  - `NEXT_PUBLIC_API_URL`: URL of the deployed FastAPI backend (e.g. `https://api.aegiscode.com`).

---

## 2. Backend API & Workers (Render)

Render service definitions are managed via `render.yaml`:

- **Web Service (`aegiscode-api`)**:
  - Runtime: Python 3.12+
  - Build Command: `pip install -e .`
  - Start Command: `uvicorn services.api.main:app --host 0.0.0.0 --port $PORT`
  - Health Check: `/health`
- **Worker Service (`aegiscode-worker`)**:
  - Executes long-running agent workflows asynchronously.
  - Runtime: Python 3.12+
  - Command: `python -m services.worker.runner`

---

## 3. Database (MongoDB Atlas)

- Create a MongoDB Atlas M0 (Free Tier) or Dedicated Cluster.
- Configure IP Access List / Network Peering.
- Provide connection string in `MONGODB_URI` (`mongodb+srv://...`).
- Database name: `aegiscode`.

---

## 4. GitHub App Setup

1. In GitHub Settings > Developer Settings > GitHub Apps, create **AegisCode App**.
2. Configure Webhook URL: `https://<your-backend-domain>/api/webhooks/github`.
3. Set Webhook secret and add to `GITHUB_WEBHOOK_SECRET`.
4. Generate a Private Key PEM and add to `GITHUB_PRIVATE_KEY`.
5. Set App ID and Client ID/Secret.
