# Atelier — AI Productivity Hub

A luxury monochrome executive workspace unifying server-side Gemini AI generation, real-time writing streams, authorized Gmail and Google Docs workflows, persistent task and project operations, and structured prompt tooling.

---

## Architecture Overview

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4 (`Plus Jakarta Sans`, `Playfair Display`, `JetBrains Mono`)
- **Backend (Full-Stack Node)**: Express server (`server.ts`) with Vite middleware in development and static serving in production (`data/hub-store.json` persistence)
- **Serverless Runtime (Netlify)**: Netlify Functions v2 (`netlify/functions/api.ts`) + `netlify.toml` redirects (`/api/*` -> `/.netlify/functions/api/:splat`) wrapping Gemini AI and Google Workspace proxy endpoints
- **Persistence Strategy**: Automatic `localStorage` fallback (`atelier_productivity_hub_v1`) when running in serverless/static mode alongside server-side JSON store in Node deployments
- **AI Engine**: `@google/genai` server-side SDK (`gemini-4-hydrogen` primary with automatic `gemini-3.1-flash-lite` resilience fallback and Server-Sent Events streaming)
- **Google Workspace Auth**: Firebase Authentication Google Sign-In requesting scoped OAuth permissions (`gmail.readonly`, `gmail.compose`, `documents`) with in-memory Bearer token forwarding and confirmation dialogs prior to mutations

---

## Modules

1. **Overview Dashboard** — Live operational KPIs, task completion rate, recent deliverables, and integration readiness.
2. **Professional Writing Lab** — Real-time SSE streaming with Gemini for emails, reports, LinkedIn posts, cover letters, tone refinement, and grammar improvement, plus ChatGPT & Claude Prompt Modes.
3. **Personal AI Workspace** — Unstructured note summarization, key-point extraction, action-item extraction (one-click import to Task Manager), and structured section organization.
4. **Google Productivity** — Scoped Gmail inbox inspection, draft creation, email sending, and Google Docs reading, creation, and appending paired with Gemini drafting and summarization.
5. **Task Manager** — Filterable, prioritized task ledger with status cycling, confirmation-guarded deletion, and one-click CSV & JSON export.
6. **Project Vault** — Initiative tracking with linked tasks, linked documents, and progress visualization.
7. **Document Library** — Searchable archive with live inline editing, Markdown export (`.md`), and full Workspace JSON backup.
8. **AI Tools Comparison** — Capability matrix comparing live Gemini integration against ChatGPT and Claude prompt-mode workflows.
9. **Command Palette (`Cmd + K` / `Ctrl + K`)** — Instant keyboard navigation across modules, tasks, projects, and documents.

---

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables based on `.env.example`:
   ```bash
   GEMINI_API_KEY="your_gemini_api_key"
   APP_URL="http://localhost:3000"
   ```
3. Start the development server on port `3000`:
   ```bash
   npm run dev
   ```
4. Verify tests, types, and production build:
   ```bash
   npx --yes tsx --test src/utils/hubLogic.test.ts
   npm run lint
   npm run build
   ```

---

## Netlify Deployment Checklist

This repository is pre-configured for Netlify via `netlify.toml` and `netlify/functions/api.ts`.

1. **Connect Repository**: Import the GitHub repository in Netlify (Build command: `npm run build`, Publish directory: `dist`).
2. **Environment Variables**: In Netlify **Site configuration -> Environment variables**, add:
   - `GEMINI_API_KEY`: Your server-side Gemini API key (never exposed to browser bundles).
3. **Firebase Authorized Domains (Required for Google Workspace OAuth)**:
   - Open **Firebase Console -> Authentication -> Settings -> Authorized domains**.
   - Add your live Netlify hostname (e.g., `your-site.netlify.app` or your custom domain) so Google Sign-In popups succeed on the live URL.

---

## Security & Design Principles

- `GEMINI_API_KEY` stays strictly on the server or inside Netlify Functions environment variables.
- Google OAuth tokens remain strictly in browser memory (`firebaseWorkspaceAuth.ts`) and are passed via Bearer headers without persistent credential storage.
- Every mutating Gmail or Google Docs operation requires explicit user confirmation.
- Strictly monochrome visual hierarchy (`#FFFFFF`, `#FAFAFA`, `#E5E5E5`, `#09090B`) with accessible native HTML controls.
