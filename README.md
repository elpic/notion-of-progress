# Notion of Progress

> AI-powered daily standup agent using Notion MCP and Claude.

Every morning, **Notion of Progress** reads your Notion task database, generates a concise standup summary (Yesterday / Today / Blockers) using Claude, and writes it back to your Notion workspace as a structured log entry — automatically.

No more staring at a blank standup form. No more forgotten tasks. Just open Notion and your standup is already there.

---

## Demo

_Video coming soon_

---

## Architecture

```
Notion Task DB
    │  (read via @notionhq/client)
    ▼
Standup Agent (Node.js + TypeScript)
    │  (Claude API — claude-sonnet-4-6)
    ▼
Notion Standup Log DB
    │  (write via Notion MCP)
    ▼
New standup page per day
```

---

## Prerequisites

- Node.js 18+
- A [Notion account](https://notion.so) with an integration token
- An [Anthropic API key](https://console.anthropic.com)

---

## Setup

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/notion-of-progress
cd notion-of-progress

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your API keys and database IDs

# 4. Create the Standup Log database in Notion
npm run setup

# 5. Run a standup manually to test
npm run standup

# 6. Start the scheduler (runs daily at 08:00 on weekdays)
npm start
```

---

## Environment Variables

See [`.env.example`](.env.example) for all required and optional variables.

---

## Built for

[DEV.to Notion MCP Challenge](https://dev.to/challenges/notion-2026-03-04) — March 2026
