# Notion of Progress

[![Integration](https://github.com/elpic/notion-of-progress/actions/workflows/integration.yml/badge.svg)](https://github.com/elpic/notion-of-progress/actions/workflows/integration.yml)

> Your daily standups, on autopilot. Claude reads your tasks every morning and writes the full Yesterday / Today / Blockers summary right into Notion — no manual updates needed.

---

[![Watch the demo](https://img.youtube.com/vi/nzLENOTIKyA/maxresdefault.jpg)](https://youtu.be/nzLENOTIKyA)

---

## What it does

**Notion of Progress** is an AI agent that runs every morning and handles your entire standup — automatically.

It connects to your Notion workspace via the **Notion MCP server**, reads your task database, generates a structured summary using **Claude**, and writes a beautifully formatted standup page — complete with linked tasks, color-coded callouts, and a Discord notification to your team.

Zero manual input. Every single day.

---

## How it works

```
┌─────────────────────────────────────────────────────────────┐
│                     Notion of Progress                       │
│                                                             │
│  1. Fetch Tasks      2. Generate Summary   3. Write Page    │
│  ─────────────       ─────────────────     ────────────     │
│  Notion Task DB  →   Claude API        →   Notion MCP   →  │
│  (typed client)      (Sonnet 4.6)          (Opus 4.6        │
│                                             Agent SDK)      │
│                                                    │        │
│                                         4. Notify  ↓        │
│                                         Discord Webhook     │
└─────────────────────────────────────────────────────────────┘
```

The magic is in **step 3** — instead of hard-coded Notion API calls, a Claude agent autonomously navigates the Notion workspace via MCP tools. It decides whether to create a new page or update an existing one, structures all the blocks, and writes everything in one pass.

---

## The standup page

Every generated standup looks like this in Notion:

| Block | Content |
|-------|---------|
| 📊 | `3 completed · 4 active · 1 blocker` |
| ✅ Yesterday | Bullet points with links to completed tasks |
| 🔨 Today | Bullet points with links to active tasks |
| 🚧 Blockers | Highlighted in red if blockers exist |

Each bullet links directly back to the source task in Notion. Pages get a random emoji icon on every run.

---

## Architecture

Built on **ports and adapters** — the core domain has zero knowledge of Notion, Claude, or any external system.

```
src/
├── core/
│   ├── domain/types.ts          ← TaskSummary, StandupSummary, StandupBullet
│   ├── ports/                   ← interfaces only, no dependencies
│   └── standup.ts               ← StandupService orchestrator
└── adapters/
    ├── notion/
    │   ├── NotionTaskRepository.ts      ← reads Task DB via @notionhq/client
    │   └── NotionStandupRepository.ts   ← writes standup pages
    ├── claude/
    │   └── ClaudeSummaryGenerator.ts    ← calls Claude API
    ├── mcp/
    │   └── McpStandupAgent.ts           ← Claude Agent SDK + Notion MCP
    └── discord/
        └── DiscordNotifier.ts           ← posts to Discord webhook
```

Swapping Notion for Linear or Claude for another model means writing one new adapter — nothing else changes.

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

Fill in the required values:

```env
NOTION_API_KEY=secret_...        # notion.so/profile/integrations/internal
ANTHROPIC_API_KEY=sk-ant-...     # console.anthropic.com/settings/keys
```

**3. Create Notion databases**

```bash
npm run setup
# or: mise run setup
```

This creates the **Task DB** and **Standup Log** in your Notion workspace and writes the IDs back to `.env` automatically.

> **Tip:** Before running setup, open your Notion page → `···` → **Connections** → connect your integration.

**4. (Optional) Connect to Notion My Tasks**

1. Open your **Task DB** → `···` → **Turn into task database**
2. Go to **Home** → **My tasks** widget → **Settings**
3. Under **Task sources**, add your **Task DB**

Tasks assigned to you will appear in **My tasks** automatically.

**5. Run your first standup**

```bash
mise run standup
```

---

## Commands

```bash
mise run standup              # generate today's standup
mise run standup -- --verbose # watch Claude think and call Notion APIs live
mise run standup -- --dry-run # preview the summary without writing to Notion
mise run start                # start the daily scheduler (weekdays at 08:00)
mise run setup                # create Notion databases
mise run test                 # run tests
mise run typecheck            # TypeScript type check
```

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NOTION_API_KEY` | ✅ | — | Notion internal integration token |
| `ANTHROPIC_API_KEY` | ✅ | — | Anthropic API key |
| `NOTION_TASK_DB_ID` | auto | — | Filled by `npm run setup` |
| `NOTION_STANDUP_LOG_DB_ID` | auto | — | Filled by `npm run setup` |
| `DISCORD_WEBHOOK_URL` | — | — | Post standup to Discord after generation |
| `CRON_SCHEDULE` | — | `0 8 * * 1-5` | Weekdays at 08:00 |
| `TZ` | — | `America/New_York` | Scheduler timezone |
| `TASK_STATUS_PROPERTY` | — | `Status` | Status property name in Task DB |
| `TASK_DONE_VALUE` | — | `Done` | Value that means "completed" |
| `TASK_TITLE_PROPERTY` | — | `Name` | Title property name in Task DB |

---

## Integrations

- **Discord** — see [docs/integrations/discord.md](docs/integrations/discord.md)

---

## Built for

[DEV.to Notion MCP Challenge](https://dev.to/challenges/notion-2026-03-04) — March 2026
