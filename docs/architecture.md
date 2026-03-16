# Architecture

Notion of Progress is built on a **ports and adapters** (hexagonal) architecture. The core domain has zero knowledge of Notion, Claude, Discord, or any external system. Every external dependency is behind an interface.

---

## Directory structure

```
src/
├── core/
│   ├── domain/
│   │   └── types.ts              ← TaskSummary, StandupSummary, StandupBullet
│   ├── ports/
│   │   ├── TaskRepository.ts     ← interface: fetchTasks()
│   │   ├── SummaryGenerator.ts   ← interface: generateSummary()
│   │   └── StandupRepository.ts  ← interface: findTodayPageId(), writeStandup(), writeFailedStandup()
│   └── standup.ts                ← StandupService orchestrator (used in tests)
└── adapters/
    ├── notion/
    │   ├── NotionTaskRepository.ts     ← reads Task DB via @notionhq/client
    │   └── NotionStandupRepository.ts  ← writes standup pages via @notionhq/client
    ├── claude/
    │   └── ClaudeSummaryGenerator.ts   ← calls Claude API (Sonnet 4.6)
    ├── mcp/
    │   ├── McpStandupAgent.ts          ← daily standup via Claude Agent SDK + Notion MCP
    │   └── McpDigestAgent.ts           ← weekly digest via Claude Agent SDK + Notion MCP
    └── discord/
        └── DiscordNotifier.ts          ← posts to Discord webhook

scripts/
├── run-mcp.ts       ← CLI entry point for daily standup
├── run-digest.ts    ← CLI entry point for weekly digest
├── seed-week.ts     ← seeds standup pages for testing
└── setup-notion.ts  ← creates Notion databases on first run
```

---

## Domain model

Three types carry all domain data:

```typescript
// A task fetched from the Notion Task DB
interface TaskSummary {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  priority: string | null;
  lastEdited: string;
  url: string;
}

// A single bullet in the standup summary
interface StandupBullet {
  text: string;
  taskId?: string;  // links back to the source task
}

// The structured standup output from Claude
interface StandupSummary {
  yesterday: StandupBullet[];
  today: StandupBullet[];
  blockers: StandupBullet[];
}
```

---

## Ports

Three interfaces define the boundary between the core and the outside world:

```typescript
// Where tasks come from
interface TaskRepository {
  fetchTasks(): Promise<{ completed: TaskSummary[]; active: TaskSummary[] }>;
}

// Who generates the summary
interface SummaryGenerator {
  generateSummary(completed: TaskSummary[], active: TaskSummary[]): Promise<StandupSummary>;
}

// Where standups are written
interface StandupRepository {
  findTodayPageId(): Promise<string | null>;
  writeStandup(summary, completed, active, existingPageId?): Promise<string>;
  writeFailedStandup(error: string): Promise<void>;
}
```

Swapping Notion for Linear or Claude for another model means writing one new adapter — nothing else changes.

---

## Daily standup pipeline

The daily standup runs as a **hybrid pipeline** with a deliberate split of responsibilities:

```
┌─────────────────────────────────────────────────────────────┐
│                     Notion of Progress                       │
│                                                             │
│  Phase 1             Phase 2              Phase 3           │
│  Fetch Tasks         Generate Summary     Write Page        │
│  ─────────────       ─────────────────    ────────────      │
│  NotionTask      →   ClaudeSummary    →   McpStandup    →   │
│  Repository          Generator            Agent             │
│  (@notionhq/         (Sonnet 4.6          (Opus 4.6 +       │
│   client)             API)                Agent SDK +       │
│                                           Notion MCP)       │
│                                                    │        │
│                                         Phase 4    ↓        │
│                                         Discord Webhook     │
└─────────────────────────────────────────────────────────────┘
```

### Why the split?

**Phase 1 uses the typed Notion client** (`@notionhq/client`) for task fetching. This gives reliable, type-safe database queries with date filters, status filters, and property mapping. The MCP server's query tools were found to be less reliable for complex filter logic.

**Phase 3 uses the Claude Agent SDK + Notion MCP** for page writing. Instead of hand-coding the create-vs-update logic, Claude navigates the workspace autonomously — it searches for an existing page, decides whether to update or create, manages block deletion and re-creation, and structures all the content. This eliminates dozens of lines of brittle Notion API glue code.

The key insight: **use the typed client where you need precision, use the MCP agent where you need autonomy.**

---

## Weekly digest pipeline

Every Friday, a second agent runs a **full read/write loop**:

```
┌──────────────────────────────────────────────────────────────┐
│                     Weekly Digest                            │
│                                                              │
│  Phase 1                    Phase 2                          │
│  Read this week's standups  Synthesize + write digest        │
│  ─────────────────────────  ──────────────────────────────   │
│  McpDigestAgent reads       McpDigestAgent synthesizes  →    │
│  5 standup pages via        wins, focus areas, blockers,     │
│  Notion MCP                 week-in-numbers and writes       │
│                             digest page via Notion MCP       │
│                                                    │         │
│                                         Discord    ↓         │
│                                         Webhook (purple)     │
└──────────────────────────────────────────────────────────────┘
```

This is the only part of the system where the agent reads pages it previously wrote — completing an autonomous loop with no human input at any stage.

---

## MCP agent internals

Both `McpStandupAgent` and `McpDigestAgent` follow the same pattern using the Claude Agent SDK:

```typescript
for await (const message of query({
  prompt: buildPrompt(...),
  options: {
    model: 'claude-opus-4-6',
    mcpServers: {
      notion: {
        command: 'npx',
        args: ['-y', '@notionhq/notion-mcp-server'],
        env: {
          OPENAPI_MCP_HEADERS: JSON.stringify({
            Authorization: `Bearer ${NOTION_API_KEY}`,
            'Notion-Version': '2022-06-28',
          }),
        },
      },
    },
    allowedTools: ['mcp__notion__*'],
    permissionMode: 'acceptEdits',
    maxTurns: 20,
  },
})) {
  // stream verbose output and capture final URL
}
```

The Notion MCP server is spawned as a local subprocess over stdio with an internal integration token in the headers. This means no OAuth is required — just a `NOTION_API_KEY` from your Notion integration settings.

With `--verbose`, every Claude reasoning step and every Notion API call is streamed to the terminal in real time:

```
💭 [Claude] A page already exists for today. I'll update it instead of creating a new one.
🔧 [MCP] [NOTION API] Get Block Children
💭 [Claude] Found 14 existing blocks. Deleting them in parallel...
🔧 [MCP] [NOTION API] Delete A Block
🔧 [MCP] [NOTION API] Delete A Block
...
🔧 [MCP] [NOTION API] Patch Block Children
💭 [Claude] Done! Here's the standup page: https://notion.so/...
```

---

## Reliability design

### Retry logic

All Notion API calls go through `withRetry` with exponential backoff:

```typescript
await withRetry(
  () => notion.databases.query(...),
  { attempts: 3, delayMs: 1000, shouldRetry: isNotionRateLimit }
);
```

`isNotionRateLimit` checks for the `rate_limited` error code so only transient errors are retried — not validation errors or bad requests.

### Block deletion safety

When updating an existing standup page, the update path:
1. Paginates through **all** existing blocks using `has_more` / `next_cursor`
2. Deletes each block with individual retry wrappers
3. Appends new blocks **before** updating page properties

This ordering means a failed append leaves the old page intact rather than showing `Status: Generated` with no content.

### Failure pages

If the standup run fails at any point, the scheduler writes a `Failed` page to the Standup Log DB so there is always a record for the day — even on errors.

---

## Scheduler

`src/index.ts` runs two cron jobs:

| Job | Default schedule | Configurable via |
|---|---|---|
| Daily standup | `0 8 * * 1-5` (weekdays at 08:00) | `CRON_SCHEDULE` |
| Weekly digest | `0 17 * * 5` (Fridays at 17:00) | `DIGEST_CRON_SCHEDULE` |

Both use the `TZ` environment variable for timezone (default: `America/New_York`).

---

## Configuration

All configuration lives in `src/config/index.ts` and is loaded from environment variables. Required variables throw at startup if missing — no silent `undefined` values at runtime.

See [`.env.example`](../.env.example) for the full list.

---

## Design decisions

**Why ports and adapters?**
The domain logic (orchestration, data shapes) is tested independently of all external systems. Changing the LLM, the task source, or the notification channel requires writing one new adapter file — no changes to the core.

**Why the typed client for reads and MCP for writes?**
The typed client gives precise, predictable query results. The MCP agent gives autonomous, flexible page management. Using each where it excels produces a more reliable system than using either exclusively.

**Why Claude Opus 4.6 for the MCP agent?**
The page writing phase involves up to 20 tool calls (search, read, delete, append) and requires the agent to make contextual decisions (create vs update, block structure, idempotency). Opus 4.6 handles this reliably. Sonnet 4.6 is used for the summary generation phase where the task is simpler and structured (JSON output).

**Why no OAuth for the MCP server?**
The `@notionhq/notion-mcp-server` supports both OAuth (for hosted use) and internal integration tokens (for local use via stdio). Spawning the server as a local subprocess with the token in `OPENAPI_MCP_HEADERS` avoids the OAuth flow entirely, making setup a single environment variable.
