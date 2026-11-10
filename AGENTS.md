<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# ⚠️ DEPLOYMENT RULES — READ BEFORE MAKING ANY CHANGES

## CRITICAL: Never Build or Deploy Directly on the Server

**DO NOT run any of the following commands on the EC2 production server:**

```
npm run build
next build
npm run start   # only if restarting without a fresh deploy
```

Running a build on the server **takes the website offline** for all users during the build process. This is strictly forbidden.

---

## ✅ How Deployment Works (CI/CD via GitHub Actions)

All builds happen **automatically on GitHub Actions** when code is pushed to the `main` branch.

### The correct workflow is:

1. Make your changes locally (or via agent)
2. Commit and push to the `main` branch (or merge a PR into `main`)
3. GitHub Actions automatically:
   - Installs dependencies
   - Runs `prisma generate`
   - Runs `npm run build` (on the CI runner, NOT the server)
   - Transfers the built `.next` artifact to the EC2 server via SCP
   - Restarts PM2 with zero-downtime (`pm2 restart farmyzest`)

**The site stays live throughout the entire process.**

---

## What You ARE Allowed to Do on the Server

If you must SSH into the EC2 server, you may only:

- Check logs: `pm2 logs farmyzest`
- Check status: `pm2 status`
- Restart the app (if already built): `pm2 restart farmyzest`
- Check disk/memory: `df -h`, `free -m`

---

## Workflow Summary for AI Agents

| Action | Allowed? |
|--------|----------|
| `git commit && git push` to trigger CI/CD | ✅ YES |
| `npm run build` on EC2 server | ❌ NEVER |
| `npm run start` on EC2 server | ❌ NEVER |
| `pm2 restart` on EC2 server (after CI/CD deploy) | ✅ OK |
| Editing files and pushing to GitHub | ✅ YES |

---

## Why This Rule Exists

The production server runs the live website 24/7. Running a build on it:
- Consumes all CPU/RAM → site becomes unresponsive
- Can take 2–5 minutes → users see downtime
- Can fail mid-build → leaves the site in a broken state

The CI/CD pipeline builds in isolation and only swaps the build artifact when it's ready — **zero downtime**.

---

## CI/CD Pipeline Reference

- Workflow file: `.github/workflows/deploy.yml`
- Triggered by: Push to `main` branch, or manual `workflow_dispatch`
- Build runs on: `ubuntu-latest` GitHub Actions runner
- Deploy method: SCP `.next` artifact to EC2, then `pm2 restart`
