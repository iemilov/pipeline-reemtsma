# Stack Configuration: Node.js / Cloudflare

## Tech Stack Overview

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router 7 |
| Build Tool | Vite 7 |
| Runtime | Cloudflare Workers (Pages Functions) |
| Database | Cloudflare D1 (SQLite) |
| Hosting | Cloudflare Pages |

## Key Libraries

| Library | Purpose |
|---------|---------|
| `react` / `react-dom` | UI framework |
| `react-router` | Client-side routing (SPA) |
| `@dnd-kit/core` / `@dnd-kit/sortable` | Drag-and-drop (Kanban board) |
| `pdf-lib` | PDF generation (invoices, ZUGFeRD) |
| `pdfjs-dist` | PDF parsing (invoice import) |

## Project Structure

- `projects/crm/src/` — Frontend React application
  - `pages/` — Page components (Dashboard, Projects, Invoices, Settings)
  - `components/` — Reusable UI components (layout, kanban, shared)
  - `App.jsx` — Root component with routing
  - `App.css` — Global styles with CSS custom properties
- `projects/crm/functions/` — Cloudflare Pages Functions (API)
  - `api/` — REST API endpoints
  - `lib/` — Shared server utilities (PDF generation, ZUGFeRD XML)
- `projects/crm/migrations/` — D1 database migration SQL files
- `projects/crm/dist/` — Build output (Vite)

## Key Commands

### Development
```bash
npm run dev                   # Build + Wrangler Pages dev server
npm run build                 # Vite production build
npm run deploy                # Build + deploy to Cloudflare Pages
```

### Linting & Formatting
```bash
npm run lint                  # ESLint on React/JSX files
```

### Database Migrations
```bash
npm run migrate:local         # Apply D1 migrations locally
npm run migrate:remote        # Apply D1 migrations to remote D1
```

## Architecture

### Frontend
- Single-page application (SPA) with React Router
- CSS custom properties for theming (light/dark mode via `[data-theme]`)
- Kanban board with drag-and-drop using @dnd-kit
- PDF invoice generation and parsing in-browser

### Backend (Cloudflare Workers)
- REST API via Pages Functions (`functions/api/`)
- D1 SQLite database for persistent storage
- Server-side PDF generation with pdf-lib
- ZUGFeRD/Factur-X XML embedding for e-invoicing compliance

### Data Model
- `projects` — Client projects
- `invoices` — Invoice headers (with Kanban status workflow)
- `invoice_line_items` — Invoice line items
- `resources` — External resources linked to projects
- `settings` — Key-value store for company settings

### Local Development
- Wrangler dev server emulates Cloudflare Workers locally
- Local D1 database persists in `.wrangler/state/v3/d1/`
- No external services required for local development

## Code Quality

### ESLint
- React Hooks rules (`eslint-plugin-react-hooks`)
- React Refresh rules (`eslint-plugin-react-refresh`)

## Conventions

- API endpoints: `functions/api/<resource>/[[path]].js` (catch-all routes)
- Database access via `env.DB` binding in Workers
- Settings stored as key-value pairs with `company_` prefix
- Invoice statuses: Draft → Sent → Paid (Kanban workflow)
- Dark mode: `[data-theme="dark"]` on `<html>`, localStorage persistence
