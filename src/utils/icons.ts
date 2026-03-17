/**
 * Shared page icons for Notion standup and digest pages
 * 
 * Provides curated sets of emoji icons that are randomly assigned
 * to standup pages and weekly digest pages for visual variety.
 */

export const PAGE_ICONS = [
  '🌅', '☀️', '⚡', '🧠', '🚀', '🎯', '🔥', '💡', '🌿', '🛠️',
  '🌊', '🎸', '🦋', '🌈', '🍀', '🏔️', '🎨', '🦁', '🌙', '✨',
  '🐉', '🎲', '🧩', '🌺', '⚙️', '🦅', '🎪', '🍉', '🔮', '🌍',
] as const;

export const DIGEST_ICONS = [
  '📅', '📊', '🗓️', '📋', '🔭', '🧭', '📈', '🏁', '🎯', '🌟',
] as const;

/**
 * Returns a random emoji icon from the PAGE_ICONS collection.
 * Used to add visual variety to generated standup pages.
 */
export function randomIcon(): string {
  return PAGE_ICONS[Math.floor(Math.random() * PAGE_ICONS.length)];
}

/**
 * Returns a random emoji icon from the DIGEST_ICONS collection.
 * Used to add visual variety to generated weekly digest pages.
 */
export function randomDigestIcon(): string {
  return DIGEST_ICONS[Math.floor(Math.random() * DIGEST_ICONS.length)];
}