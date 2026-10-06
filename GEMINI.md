# Alister Blog — Gemini Context

Read and follow the canonical repository instructions:

@./AGENTS.md

Read the current implementation and deployment status before making changes:

@./docs/project-status.md

Inspect task-specific code and documentation before editing.

Rules:
- Treat `AGENTS.md` as canonical and preserve existing user changes.
- Never edit `node_modules/shirones/`.
- Never run remote D1 migrations or production deployment actions without explicit user authorization.
- Public visitor APIs belong to Cloudflare Pages Functions + D1; keep them separate from the private JD Cloud Admin/CMS backend.
