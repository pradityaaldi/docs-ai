# docs-ai

An AI-powered document workspace built with SvelteKit. Chat with multiple LLM providers, generate and edit documents, and export them to PDF or DOCX — all through a single, provider-agnostic interface.

## Overview

docs-ai connects to any major LLM provider through configurable **connectors**, streams responses in real time, and turns AI conversations into structured, exportable documents. It's designed to be model-agnostic: switch between OpenAI, Anthropic, and Google Gemini without changing the app.

## Features

- **Multi-provider AI integration** — OpenAI, Anthropic (Claude), and Google Gemini behind one unified streaming interface
- **Real-time streaming** — token-by-token responses with abort and 60s upstream timeout handling
- **Connectors** — add, test, activate, and manage AI provider configurations (base URL, model, API key) via a REST API
- **Document generation** — turn chat output into documents, preview them live, and export to **PDF** and **DOCX**
- **Code editor** — built-in CodeMirror editor with JSON support
- **Local persistence** — connectors and documents stored in SQLite (better-sqlite3)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | SvelteKit (full-stack) |
| Language | TypeScript |
| AI | OpenAI / Anthropic / Gemini APIs (streaming) |
| Database | SQLite (better-sqlite3) |
| Editor | CodeMirror 6 |
| Export | pdfkit (PDF), docx (DOCX), marked (Markdown) |

## Architecture

```
SvelteKit frontend (chat UI, document preview, editor)
        │  REST API
        ▼
+server.ts routes
  ├── /api/chat            stream AI responses
  ├── /api/connectors      CRUD + test + activate AI providers
  └── /api/documents       create / read / manage documents
        │
        ▼
server/ai.ts   → provider-agnostic streaming (OpenAI / Anthropic / Gemini)
server/db.ts   → SQLite persistence
server/pdf.ts  → PDF export
server/docx.ts → DOCX export
```

## Getting Started

```bash
# install dependencies
pnpm install

# run dev server
pnpm dev

# build for production
pnpm build
```

Open http://localhost:5173, add an AI connector (provider + base URL + model + API key) in Settings, activate it, and start chatting.

## Key Implementation Details

- **Provider abstraction** (`src/lib/server/ai.ts`): a single `streamAIResponse()` dispatches to provider-specific streamers, normalizing OpenAI, Anthropic, and Gemini response formats into a common `AIStreamChunk` stream.
- **Resilient networking**: per-request `AbortController`, upstream connect timeout, and propagated cancellation so the UI can stop generation cleanly.
- **API-key safety**: keys live server-side in connectors and never reach the client bundle.

## License

MIT
