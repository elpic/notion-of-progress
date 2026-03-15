/**
 * McpStandupAgent
 *
 * Uses the Claude Agent SDK with the Notion MCP server as a tool.
 * Claude autonomously reads the Task DB, generates a standup summary,
 * and writes the standup page — all via Notion MCP tool calls.
 *
 * This replaces the three-adapter pipeline (NotionTaskRepository →
 * ClaudeSummaryGenerator → NotionStandupRepository) with a single
 * agentic loop where Claude drives everything.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { config } from '../../config/index';
import { todayISO, todayFormatted, yesterdayISO } from '../../utils/dateHelpers';
import { logger } from '../../utils/logger';

const SYSTEM_PROMPT = `You are a daily standup assistant with access to a Notion workspace via MCP tools.

Your job:
1. Query the Task DB (database ID: ${config.notion.taskDbId}) to fetch:
   - Tasks with Status = "Done" that were last edited on or after ${yesterdayISO()}
   - Tasks with Status != "Done" (active tasks)
2. Generate a concise standup summary with three sections:
   - Yesterday: what was completed
   - Today: what is in progress or planned
   - Blockers: any blocked tasks (Status = "Blocked"), or "No blockers" if none
3. Find if a standup page already exists in the Standup Log DB (database ID: ${config.notion.standupLogDbId}) for today (${todayISO()}). If it exists, update its content. If not, create a new page.
4. Write the standup page with:
   - Title: "Standup · ${todayFormatted()}"
   - Date property: ${todayISO()}
   - Status property: "Generated"
   - Page content using callout blocks:
     * A gray callout with 📊 showing task counts
     * A green callout with ✅ for "Yesterday" section
     * A blue callout with 🔨 for "Today" section
     * A red or gray callout with 🚧 for "Blockers" section
   - Bullet points under each callout with the standup items

Be concise. Each bullet should be one clear sentence. Maximum 5 bullets per section.
When done, output the URL of the standup page.`;

export async function runMcpStandupAgent(): Promise<string> {
  logger.info('Starting Notion MCP standup agent');

  let standupUrl = '';

  for await (const message of query({
    prompt: `Generate today's standup for ${todayFormatted()} (${todayISO()}).`,
    options: {
      model: 'claude-opus-4-6',
      systemPrompt: SYSTEM_PROMPT,
      mcpServers: {
        notion: {
          command: 'npx',
          args: ['-y', '@notionhq/notion-mcp-server'],
          env: {
            OPENAPI_MCP_HEADERS: JSON.stringify({
              Authorization: `Bearer ${config.notion.apiKey}`,
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
    if ('result' in message) {
      const result = message.result ?? '';
      // Extract the Notion URL from Claude's final response
      const urlMatch = result.match(/https:\/\/www\.notion\.so\/[^\s)>\]"]+/);
      if (urlMatch) standupUrl = urlMatch[0];
      logger.info(`Agent result: ${result.slice(0, 200)}${result.length > 200 ? '...' : ''}`);
    }
  }

  if (!standupUrl) {
    throw new Error('MCP agent completed but no standup URL was found in the output');
  }

  return standupUrl;
}
