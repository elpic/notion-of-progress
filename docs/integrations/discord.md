# Discord Notifications

Send a summary of your daily standup to a Discord channel automatically after it's generated.

---

## How it works

After Notion of Progress writes the standup page, it posts a message to a Discord channel via a webhook. The message includes the standup sections (Yesterday / Today / Blockers) and a direct link to the Notion page.

---

## Setup

### 1. Create a Discord Webhook

1. Open Discord and go to the channel where you want to receive standup notifications
2. Click the **gear icon** next to the channel name to open **Channel Settings**
3. Go to **Integrations** → **Webhooks**
4. Click **New Webhook**
5. Give it a name (e.g. `Notion of Progress`) and optionally set an avatar
6. Click **Copy Webhook URL**

### 2. Add the URL to your `.env`

Open your `.env` file and add:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
```

### 3. Run the standup

```bash
mise run standup
```

After the Notion page is written, a notification will be posted to your Discord channel automatically.

> **Note:** If `DISCORD_WEBHOOK_URL` is not set, notifications are silently skipped — the standup still runs normally.

---

## Example notification

```
📋 Standup · Sunday, Mar 16

✅ Yesterday
  • Completed user authentication setup with JWT tokens
  • Finished designing onboarding flow screens in Figma

🔨 Today
  • Integrating Stripe payment webhooks
  • PostgreSQL schema migration for multi-tenancy

🚧 Blockers
  • Node.js upgrade blocked pending team approval

🔗 https://notion.so/Standup-Sunday-Mar-16-...
```
