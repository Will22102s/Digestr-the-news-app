# The Daily Digest

A minimalist, Apple-style daily reader for **Artificial Intelligence** and
**Cybersecurity** news. Browse a live feed of headlines, or ask the editor to
synthesize the day into one calm, cited briefing.

> **Status:** Step 2 — RSS ingestion, cross-feed deduplication, OPML, and the
> Gemini editorial engine with a complete JSON API. The three-column reader UI
> lands next.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 4, Lucide icons |
| Database | SQLite via `better-sqlite3` + Drizzle ORM |
| Ingestion | `rss-parser` + `p-limit` |
| AI | Google Gemini (`gemini-3.8-flash`) via `@google/genai` |
| Reading | `react-markdown` + `remark-gfm` (Step 3) |
| OPML | `fast-xml-parser` |

## Quick start

```bash
npm install
cp .env.example .env           # add GEMINI_API_KEY for AI synthesis
npm run db:setup               # apply migrations + seed 2 categories & 28 sources
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The setup screen confirms
that SQLite, the schema, and the seed data are ready.

### Load today's news

```bash
curl -X POST http://localhost:3000/api/feeds/sync
curl http://localhost:3000/api/articles?limit=5
```

The sync endpoint fetches all active sources with bounded concurrency, records
`lastFetchedAt`, and deduplicates by canonicalized URL. One broken source never
aborts the batch — failures are returned in the report.

To write a briefing, add your `GEMINI_API_KEY` to `.env`, restart, then:

```bash
curl -X POST http://localhost:3000/api/briefings/generate \
  -H 'content-type: application/json' \
  -d '{"categorySlug":"ALL"}'
```

The database lives at `data/digest.db` and is ignored by git.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run db:setup` | Run migrations and seed if empty |
| `npm run db:seed` | Seed categories and starter sources |
| `npm run db:generate` | Generate a migration after editing the schema |
| `npm run db:push` | Push the schema directly to SQLite (prototyping) |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |

`npm run db:seed -- --force` adds any missing starter feeds to an existing
database without touching your articles or bookmarks. Seeding is always
idempotent.

## Project structure

```text
src/
├── app/
│   ├── api/
│   │   ├── articles/              # Browse, search, bookmark
│   │   ├── briefings/             # Latest briefing + generate
│   │   ├── feeds/sync/            # RSS ingestion (POST + cron GET)
│   │   └── sources/               # Source CRUD + OPML import/export
│   ├── globals.css                # Obsidian surfaces, frosted glass, type tokens
│   ├── layout.tsx                 # Root shell, metadata, dark theme
│   └── page.tsx                   # Step 2 setup screen
├── db/
│   ├── index.ts                   # SQLite connection (WAL, FKs, dev singleton)
│   ├── schema.ts                  # categories · feeds · articles · briefings
│   └── seed.ts                    # Idempotent seed with 28 curated sources
└── lib/
    ├── briefing.ts                # Story selection, prompt, Gemini, citations
    ├── categories.ts              # Shared slugs, labels, category metadata
    ├── dedupe.ts                  # Title tokenization + near-duplicate removal
    ├── errors.ts                  # Typed application errors
    ├── http.ts                    # JSON validation, auth, error envelopes
    ├── opml.ts                    # OPML 2.0 build/parse
    ├── rss.ts                     # Fetch, normalize, dedupe, batch upsert
    ├── text.ts                    # HTML cleanup, read time, XML escaping
    └── url.ts                     # URL canonicalization
drizzle/                           # Committed SQL migrations
data/                              # Local SQLite database (gitignored)
```

## Data model

- **categories** — editorial sections (`AI`, `CYBERSEC`) with an accent color.
- **feeds** — RSS/Atom sources, grouped by category. `sourceType` distinguishes
  `rss`, `community`, and `advisory` sources.
- **articles** — normalized headlines. `url` is globally unique, which is the
  backbone of cross-feed deduplication; `isBookmarked` powers the reading list.
- **briefings** — Gemini-written markdown briefings with read time and source
  count.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` / `GET` | `/api/feeds/sync` | Sync active sources (optional `category`, `feedId`, `limit`, `concurrency`) |
| `GET` | `/api/articles` | Filter by `category`, `q`, `bookmarked`; paginate with `limit` + `offset` |
| `PATCH` | `/api/articles` | Set or toggle `isBookmarked` for an article id |
| `GET` | `/api/briefings` | Latest briefings, optional `category` + `limit` |
| `POST` | `/api/briefings/generate` | Deduplicate top stories and synthesize a briefing |
| `GET` | `/api/sources` | List sources with article counts |
| `POST` | `/api/sources` | Validate and add an RSS/Atom source |
| `PATCH` | `/api/sources` | Rename, recategorize, disable, or re-point a source |
| `DELETE` | `/api/sources?id=` | Remove a source and its articles |
| `GET` | `/api/sources/opml` | Export all sources as OPML |
| `POST` | `/api/sources/opml` | Import an OPML file (multipart `file` or raw XML) |

Errors use a stable envelope:

```json
{ "error": { "code": "INVALID_INPUT", "message": "category must be ALL, AI, or CYBERSEC." } }
```

### Editorial pipeline

1. Gather up to 240 recent stories (72-hour window, with a quiet-day fallback).
2. Collapse near-duplicate headlines using title-token Jaccard similarity.
3. Cap repeated coverage at two stories per source and balance AI vs. security.
4. Ask `gemini-3.8-flash` for structured JSON: a headline plus 600–800 words of
   Markdown with `##` sections and inline `[Source](url)` citations.
5. Strip any citation that does not match a supplied source, compute read time,
   and persist the briefing.

## Starter sources

**AI (16):** OpenAI, Google DeepMind, Google AI Blog, Google Research, Hugging
Face, The Verge AI, MIT Technology Review AI, Ars Technica, NVIDIA, arXiv cs.AI,
Import AI, The Gradient, Simon Willison, The Decoder, Hacker News, and Hacker
News AI.

**Cybersecurity (12):** The Hacker News, BleepingComputer, Krebs on Security,
CISA Advisories, Dark Reading, SecurityWeek, The Record, Schneier on Security,
SANS Internet Storm Center, Google Project Zero, CyberScoop, and Hacker News
Security.

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | No | SQLite path, default `./data/digest.db` |
| `GEMINI_API_KEY` | For synthesis | Google AI Studio API key |
| `GEMINI_MODEL` | No | Defaults to `gemini-3.8-flash` |
| `CRON_SECRET` | No | Optional protection for ingestion/synthesis endpoints |
| `SYNC_CONCURRENCY` | No | Parallel feed fetches, default `8` (max 50) |

## Roadmap

- [x] **Step 1** — scaffold, schema, migrations, seed
- [x] **Step 2** — RSS sync engine, deduplicator, Gemini briefing API
- [ ] **Step 3** — three-column Apple-style reader, sources manager UI, OPML controls
- [ ] **Step 4** — polished README, screenshots, deploy notes
