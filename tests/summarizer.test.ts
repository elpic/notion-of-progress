// TODO (Day 10): Tests for summarizer
// - Mock Claude API responses
// - Test JSON parsing
// - Test fallback regex extractor for markdown-wrapped JSON

import { describe, it, expect } from 'vitest';

describe('summarizer', () => {
  it.todo('parses clean JSON response from Claude');
  it.todo('handles JSON wrapped in markdown code block');
  it.todo('returns empty arrays when no tasks provided');
});
