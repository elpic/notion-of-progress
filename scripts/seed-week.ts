/**
 * scripts/seed-week.ts
 *
 * Creates one realistic standup page per weekday of a given week
 * in the Standup Log DB, so the weekly digest agent has real data to read.
 *
 * Safe to run multiple times — skips days that already have a page.
 *
 * Usage:
 *   mise run seed-week                  # seed current week (up to today)
 *   mise run seed-week -- --week -1     # seed last week (all 5 days)
 *   mise run seed-week -- --week -2     # seed two weeks ago
 */

import 'dotenv/config';
import { Client } from '@notionhq/client';
import { config } from '../src/config/index';
import { logger } from '../src/utils/logger';
import { randomIcon } from '../src/utils/icons';

type ApiColor = 'default' | 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red'
  | 'default_background' | 'gray_background' | 'brown_background' | 'orange_background' | 'yellow_background'
  | 'green_background' | 'blue_background' | 'purple_background' | 'pink_background' | 'red_background';

const notion = new Client({ auth: config.notion.apiKey });

// ─── CLI args ─────────────────────────────────────────────────────────────────

function getWeekOffset(): number {
  const idx = process.argv.indexOf('--week');
  if (idx !== -1 && process.argv[idx + 1] !== undefined) {
    const val = parseInt(process.argv[idx + 1], 10);
    if (!isNaN(val)) return val;
  }
  return 0;
}

// ─── Week helpers ─────────────────────────────────────────────────────────────

function getWeekdayDates(weekOffset: number): Array<{ iso: string; label: string; dayName: string }> {
  const tz = process.env.TZ ?? 'America/New_York';
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const monday = new Date(today);
  // Move to this week's Monday, then apply week offset
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + weekOffset * 7);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  return days.map((dayName, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toLocaleDateString('en-CA', { timeZone: tz });
    const label = d.toLocaleDateString('en-US', {
      timeZone: tz,
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    return { iso, label, dayName };
  });
}

// ─── Seed data ────────────────────────────────────────────────────────────────

interface DayData {
  completed: number;
  active: number;
  blockers: number;
  yesterday: string[];
  today: string[];
  blockerList: string[];
}

const SEED_DATA: Record<string, DayData> = {
  Monday: {
    completed: 2,
    active: 4,
    blockers: 0,
    yesterday: [
      'Reviewed and merged the authentication refactor PR',
      'Updated the API rate limiting documentation',
    ],
    today: [
      'Start work on the user dashboard redesign',
      'Fix the pagination bug in the task list endpoint',
      'Sync with design team on new component specs',
      'Review open pull requests from the weekend',
    ],
    blockerList: [],
  },
  Tuesday: {
    completed: 3,
    active: 3,
    blockers: 1,
    yesterday: [
      'Completed the user dashboard wireframes with design team',
      'Fixed the pagination bug — deployed to staging',
      'Reviewed and approved two open PRs',
    ],
    today: [
      'Implement the dashboard frontend components',
      'Write unit tests for the pagination fix',
      'Investigate the slow query in the reports endpoint',
    ],
    blockerList: [
      'Waiting on design assets for the new dashboard header — blocked on Figma export',
    ],
  },
  Wednesday: {
    completed: 2,
    active: 4,
    blockers: 1,
    yesterday: [
      'Built the first pass of dashboard components',
      'Unit tests for pagination fix — all passing',
    ],
    today: [
      'Continue dashboard components — add charts and filters',
      'Profile the slow reports query with EXPLAIN ANALYZE',
      'Write integration tests for the auth flow',
      'Sync with backend team on API contract changes',
    ],
    blockerList: [
      'Design assets still pending — dashboard header blocked, proceeding with placeholder',
    ],
  },
  Thursday: {
    completed: 4,
    active: 2,
    blockers: 0,
    yesterday: [
      'Dashboard charts and filters implemented',
      'Reports query optimized — 3x speedup with index hint',
      'Integration tests for auth flow — green',
      'API contract review completed with backend team',
    ],
    today: [
      'Polish the dashboard — responsive layout and dark mode',
      'Write the deployment runbook for the new dashboard',
    ],
    blockerList: [],
  },
  Friday: {
    completed: 3,
    active: 1,
    blockers: 0,
    yesterday: [
      'Dashboard responsive layout and dark mode complete',
      'Deployment runbook written and reviewed',
      'Final QA pass on the dashboard — no critical issues',
    ],
    today: [
      'Deploy the dashboard to production after standup',
    ],
    blockerList: [],
  },
};

// ─── Block builders ───────────────────────────────────────────────────────────

function bullet(text: string) {
  return {
    type: 'bulleted_list_item' as const,
    bulleted_list_item: {
      rich_text: [{ type: 'text' as const, text: { content: text } }],
    },
  };
}

function callout(emoji: string, text: string, color: ApiColor) {
  return {
    type: 'callout' as const,
    callout: {
      rich_text: [{ type: 'text' as const, text: { content: text } }],
      icon: { type: 'emoji' as const, emoji: emoji as never },
      color,
    },
  };
}

function divider() {
  return { type: 'divider' as const, divider: {} };
}

function paragraphItalic(text: string) {
  return {
    type: 'paragraph' as const,
    paragraph: {
      rich_text: [{
        type: 'text' as const,
        text: { content: text },
        annotations: { italic: true, color: 'gray' as const },
      }],
    },
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function pageExistsForDate(dateISO: string): Promise<boolean> {
  const response = await notion.databases.query({
    database_id: config.notion.standupLogDbId,
    filter: { property: 'Date', date: { equals: dateISO } },
    page_size: 1,
  });
  return response.results.length > 0;
}

async function seedDay(iso: string, label: string, dayName: string): Promise<void> {
  const exists = await pageExistsForDate(iso);
  if (exists) {
    logger.info(`  ${dayName} (${iso}) — already exists, skipping`);
    return;
  }

  const data = SEED_DATA[dayName];
  const children = [
    callout('📊', `${data.completed} completed · ${data.active} active · ${data.blockers} blocker${data.blockers !== 1 ? 's' : ''}`, 'gray_background' as ApiColor),
    divider(),
    callout('✅', 'Yesterday', 'green_background' as ApiColor),
    ...data.yesterday.map(bullet),
    callout('🔨', 'Today', 'blue_background' as ApiColor),
    ...data.today.map(bullet),
    callout('🚧', 'Blockers', (data.blockers > 0 ? 'red_background' : 'gray_background') as ApiColor),
    ...(data.blockerList.length > 0 ? data.blockerList.map(bullet) : [bullet('No blockers.')]),
    divider(),
    paragraphItalic(`Generated by Notion of Progress · ${iso} · seeded for digest demo`),
  ];

  await notion.pages.create({
    parent: { database_id: config.notion.standupLogDbId },
    icon: { type: 'emoji', emoji: randomIcon() as never },
    properties: {
      Title: { title: [{ type: 'text', text: { content: `Standup · ${label}` } }] },
      Date: { date: { start: iso } },
      Status: { select: { name: 'Generated' } },
      'Tasks Reviewed': { number: data.completed + data.active },
    },
    children,
  });

  logger.info(`  ${dayName} (${iso}) — created ✓`);
}

async function main(): Promise<void> {
  const weekOffset = getWeekOffset();
  const weekLabel = weekOffset === 0 ? 'current week' : weekOffset === -1 ? 'last week' : `${Math.abs(weekOffset)} weeks ago`;
  logger.info(`Seeding standup pages for ${weekLabel}...`);

  const days = getWeekdayDates(weekOffset);
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: process.env.TZ ?? 'America/New_York',
  });

  for (const { iso, label, dayName } of days) {
    // Only skip future dates when seeding the current week
    if (weekOffset === 0 && iso > today) {
      logger.info(`  ${dayName} (${iso}) — future date, skipping`);
      continue;
    }
    await seedDay(iso, label, dayName);
  }

  logger.info('Done. Run `mise run digest -- --verbose` to see the digest agent in action.');
}

main().catch((err) => {
  logger.error(`Seed failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
