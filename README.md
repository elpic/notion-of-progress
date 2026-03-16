# Notion of Progress

[![Integration](https://github.com/elpic/notion-of-progress/actions/workflows/integration.yml/badge.svg)](https://github.com/elpic/notion-of-progress/actions/workflows/integration.yml)

> AI-powered daily standup agent using Notion MCP and Claude.

Every morning, **Notion of Progress** reads your Notion task database, generates a concise standup summary (Yesterday / Today / Blockers) using Claude, and writes it back to your Notion workspace as a structured log entry — automatically.

No more staring at a blank standup form. No more forgotten tasks. Just open Notion and your standup is already there.

---

## Demo

[![Watch the demo](https://img.youtube.com/vi/nzLENOTIKyA/maxresdefault.jpg)](https://youtu.be/nzLENOTIKyA)

---

## How it works

```
Notion Task DB
    │  read tasks (completed yesterday + active today)
    ▼
StandupService
    │  generate summary via Claude API (claude-sonnet-4-6)
    ▼
Notion Standup Log DB
    │  write structured standup page
    ▼
Standup — YYYY-MM-DD
  ## Yesterday
  - Completed auth module refactor
  ## Today
  - Implement notification service
  ## Blockers
  - Waiting on design assets
```

---

## Architecture

Notion of Progress is built on a **ports and adapters** architecture — the core domain has zero knowledge of Notion, Claude, or any external system.

```
src/
├── core/
│   ├── domain/types.ts              ← TaskSummary, StandupSummary
│   ├── ports/
│   │   ├── TaskRepository.ts        ← interface: how to fetch tasks
│   │   ├── SummaryGenerator.ts      ← interface: how to generate summaries
│   │   └── StandupRepository.ts     ← interface: how to write standups
│   └── standup.ts                   ← StandupService orchestrator
└── adapters/
    ├── notion/
    │   ├── NotionTaskRepository.ts      ← reads Task DB
    │   └── NotionStandupRepository.ts   ← writes Standup Log
    └── claude/
        └── ClaudeSummaryGenerator.ts    ← calls Claude API
```

Swapping Notion for Linear or Claude for another model means writing one new adapter — nothing else changes.

---

## Prerequisites

- [Node.js](https://nodejs.org) 18+ (or use [mise](https://mise.jdx.dev))
- A [Notion account](https://notion.so)
- A Notion internal integration token — create one at [notion.so/profile/integrations/internal](https://www.notion.so/profile/integrations/internal)
- An [Anthropic API key](https://console.anthropic.com/settings/keys)

---

## Setup

**1. Clone and install**

```bash
git clone https://github.com/elpic/notion-of-progress
cd notion-of-progress
npm install
# or: mise run install
```

**2. Configure environment**

```bash
cp .env.example .env
```

Open `.env` and fill in the two required values:

```env
NOTION_API_KEY=<your internal integration token>
ANTHROPIC_API_KEY=<your anthropic api key>
```

**3. Create Notion databases**

```bash
npm run setup
# or: mise run setup
```

This will:
- Ask for the URL of a Notion page your integration has access to
- Create the **Task DB** and **Standup Log** databases under it
- Write the database IDs back to your `.env` automatically

> **Tip:** Before running setup, open your Notion page → click `···` → **Connections** → connect your integration.

**4. (Optional) Connect to Notion My Tasks**

The Task DB has **Status**, **Assignee**, and **Due Date** properties — everything needed to power Notion's built-in **My tasks** view. This is a one-time manual step:

1. Open your **Task DB** in Notion
2. Click `···` (top right) → **Turn into task database**
3. Go to your **Home** page in the Notion sidebar
4. Scroll to the **My tasks** widget → click **Settings**
5. Under **Task sources**, select your **Task DB**
6. Click **Done**

Any task with **Assignee** set to you will now appear in **My tasks** automatically.

> **Note:** This cannot be automated via the Notion API — it must be done manually in the Notion app.

**5. Run your first standup**

```bash
npm run standup
# or: mise run standup
```

**6. Start the scheduler**

```bash
npm start
# or: mise run start
```

The scheduler runs the standup pipeline every weekday at 08:00 (configurable via `CRON_SCHEDULE` and `TZ` in `.env`).

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NOTION_API_KEY` | ✅ | — | Notion internal integration token |
| `ANTHROPIC_API_KEY` | ✅ | — | Anthropic API key |
| `NOTION_TASK_DB_ID` | auto | — | Filled by `npm run setup` |
| `NOTION_STANDUP_LOG_DB_ID` | auto | — | Filled by `npm run setup` |
| `CRON_SCHEDULE` | — | `0 8 * * 1-5` | Weekdays at 08:00 |
| `TZ` | — | `America/New_York` | Scheduler timezone |
| `TASK_STATUS_PROPERTY` | — | `Status` | Name of the status property in your Task DB |
| `TASK_DONE_VALUE` | — | `Done` | Value that means "completed" |
| `TASK_TITLE_PROPERTY` | — | `Name` | Name of the title property in your Task DB |

---

## mise tasks

If you use [mise](https://mise.jdx.dev), all operations are available as tasks:

```bash
mise run install    # install dependencies
mise run setup      # create Notion databases
mise run standup    # run the standup pipeline once
mise run start      # start the scheduler
mise run typecheck  # TypeScript type check
mise run test       # run tests
```

---

## Development

```bash
npm run typecheck   # type check
npm test            # run tests (21 tests, no API calls needed)
npm run dev         # start with file watching
```

---

## Built for

[DEV.to Notion MCP Challenge](https://dev.to/challenges/notion-2026-03-04) — March 2026
