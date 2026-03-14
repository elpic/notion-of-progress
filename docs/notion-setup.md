# Notion Workspace Setup

## Workspace structure

The agent uses two databases inside a parent page called **Notion of Progress**.

| Resource | Notion URL | ID |
|---|---|---|
| Parent page | https://www.notion.so/323d528f956e81909f70e288ab306002 | `323d528f-956e-8190-9f70-e288ab306002` |
| Task DB | https://www.notion.so/3b9b1e48bdcb4311bd8b43ce779a8a6d | `3b9b1e48-bdcb-4311-bd8b-43ce779a8a6d` |
| Standup Log | https://www.notion.so/b171ff6978bd4580aad9ae8e196726a2 | `b171ff69-78bd-4580-aad9-ae8e196726a2` |

## Task DB schema

| Property | Type | Values |
|---|---|---|
| Name | Title | — |
| Status | Select | `To Do`, `In Progress`, `Done`, `Blocked` |
| Priority | Select | `High`, `Medium`, `Low` |
| Due Date | Date | — |
| Notes | Rich Text | — |

## Standup Log schema

| Property | Type | Values |
|---|---|---|
| Title | Title | e.g. `Standup — 2026-03-14` |
| Date | Date | ISO date |
| Status | Select | `Generated`, `Draft`, `Failed` |
| Tasks Reviewed | Number | count of tasks included |

## Environment variables

Copy these into your `.env`:

```
NOTION_TASK_DB_ID=3b9b1e48-bdcb-4311-bd8b-43ce779a8a6d
NOTION_STANDUP_LOG_DB_ID=b171ff69-78bd-4580-aad9-ae8e196726a2
TASK_STATUS_PROPERTY=Status
TASK_DONE_VALUE=Done
TASK_TITLE_PROPERTY=Name
```

## Getting a Notion API key

1. Go to https://www.notion.com/my-integrations
2. Click **New integration**
3. Give it a name (e.g. `notion-of-progress`), select your workspace
4. Copy the **Internal Integration Token** → this is your `NOTION_API_KEY`
5. Open the **Notion of Progress** parent page in Notion
6. Click `...` → **Connect to** → select your integration
