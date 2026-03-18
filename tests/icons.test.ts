/**
 * Tests for Icon Utilities
 * 
 * Tests the emoji icon selection functions used to add visual variety
 * to Notion pages throughout the application.
 */

import { describe, it, expect, vi } from 'vitest';
import { randomIcon, randomDigestIcon, PAGE_ICONS, DIGEST_ICONS } from '../src/utils/icons';

describe('Icon Utilities', () => {
  describe('PAGE_ICONS constant', () => {
    it('should contain a variety of page icons', () => {
      expect(PAGE_ICONS.length).toBeGreaterThan(20);
      expect(PAGE_ICONS).toContain('🌅');
      expect(PAGE_ICONS).toContain('🚀');
      expect(PAGE_ICONS).toContain('💡');
    });

    it('should contain only emoji characters', () => {
      PAGE_ICONS.forEach(icon => {
        expect(typeof icon).toBe('string');
        expect(icon.length).toBeGreaterThanOrEqual(1);
        expect(icon.length).toBeLessThanOrEqual(4); // Some complex emojis are 3+ chars (e.g., ☀️, 🛠️)
      });
    });

    it('should not contain duplicate icons', () => {
      const uniqueIcons = [...new Set(PAGE_ICONS)];
      expect(uniqueIcons.length).toBe(PAGE_ICONS.length);
    });
  });

  describe('DIGEST_ICONS constant', () => {
    it('should contain digest-specific icons', () => {
      expect(DIGEST_ICONS.length).toBeGreaterThan(5);
      expect(DIGEST_ICONS).toContain('📅');
      expect(DIGEST_ICONS).toContain('📊');
      expect(DIGEST_ICONS).toContain('📈');
    });

    it('should contain only emoji characters', () => {
      DIGEST_ICONS.forEach(icon => {
        expect(typeof icon).toBe('string');
        expect(icon.length).toBeGreaterThanOrEqual(1);
        expect(icon.length).toBeLessThanOrEqual(4); // Some complex emojis are 3+ chars
      });
    });

    it('should not contain duplicate icons', () => {
      const uniqueIcons = [...new Set(DIGEST_ICONS)];
      expect(uniqueIcons.length).toBe(DIGEST_ICONS.length);
    });

    it('should be different from PAGE_ICONS', () => {
      // Digest icons should be more report/data focused
      const overlap = PAGE_ICONS.filter(icon => DIGEST_ICONS.includes(icon as any));
      // Some overlap is okay, but they should be mostly different
      expect(overlap.length).toBeLessThan(PAGE_ICONS.length / 2);
    });
  });

  describe('randomIcon', () => {
    it('should return a valid page icon', () => {
      const icon = randomIcon();
      expect(typeof icon).toBe('string');
      expect(PAGE_ICONS).toContain(icon as any);
    });

    it('should return different icons across multiple calls', () => {
      const icons = Array.from({ length: 50 }, () => randomIcon());
      const uniqueIcons = [...new Set(icons)];
      
      // With 50 calls and 30+ available icons, should get some variety
      expect(uniqueIcons.length).toBeGreaterThan(1);
    });

    it('should handle Math.random edge cases', () => {
      // Mock Math.random to return 0 (first icon)
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(randomIcon()).toBe(PAGE_ICONS[0]);

      // Mock Math.random to return almost 1 (last icon)
      vi.mocked(Math.random).mockReturnValue(0.9999);
      expect(randomIcon()).toBe(PAGE_ICONS[PAGE_ICONS.length - 1]);

      // Restore Math.random
      vi.mocked(Math.random).mockRestore();
    });

    it('should never return undefined or empty string', () => {
      // Test many iterations to ensure robustness
      for (let i = 0; i < 100; i++) {
        const icon = randomIcon();
        expect(icon).toBeTruthy();
        expect(icon.length).toBeGreaterThan(0);
      }
    });
  });

  describe('randomDigestIcon', () => {
    it('should return a valid digest icon', () => {
      const icon = randomDigestIcon();
      expect(typeof icon).toBe('string');
      expect(DIGEST_ICONS).toContain(icon as any);
    });

    it('should return different icons across multiple calls', () => {
      const icons = Array.from({ length: 30 }, () => randomDigestIcon());
      const uniqueIcons = [...new Set(icons)];
      
      // With 30 calls and 10+ available icons, should get some variety
      expect(uniqueIcons.length).toBeGreaterThan(1);
    });

    it('should handle Math.random edge cases', () => {
      // Mock Math.random to return 0 (first icon)
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(randomDigestIcon()).toBe(DIGEST_ICONS[0]);

      // Mock Math.random to return almost 1 (last icon)
      vi.mocked(Math.random).mockReturnValue(0.9999);
      expect(randomDigestIcon()).toBe(DIGEST_ICONS[DIGEST_ICONS.length - 1]);

      // Restore Math.random
      vi.mocked(Math.random).mockRestore();
    });

    it('should never return undefined or empty string', () => {
      // Test many iterations to ensure robustness
      for (let i = 0; i < 100; i++) {
        const icon = randomDigestIcon();
        expect(icon).toBeTruthy();
        expect(icon.length).toBeGreaterThan(0);
      }
    });
  });

  describe('randomness distribution', () => {
    it('should have reasonable distribution for page icons', () => {
      // Generate many icons and check distribution
      const iconCounts: Record<string, number> = {};
      const iterations = 1000;
      
      for (let i = 0; i < iterations; i++) {
        const icon = randomIcon();
        iconCounts[icon] = (iconCounts[icon] || 0) + 1;
      }

      const uniqueIconsSeen = Object.keys(iconCounts);
      
      // Should see most of the available icons
      expect(uniqueIconsSeen.length).toBeGreaterThan(PAGE_ICONS.length * 0.8);
      
      // No single icon should be overly dominant (basic randomness check)
      const maxCount = Math.max(...Object.values(iconCounts));
      const expectedAverage = iterations / PAGE_ICONS.length;
      expect(maxCount).toBeLessThan(expectedAverage * 3); // Allow 3x variance
    });

    it('should have reasonable distribution for digest icons', () => {
      // Generate many icons and check distribution
      const iconCounts: Record<string, number> = {};
      const iterations = 500;
      
      for (let i = 0; i < iterations; i++) {
        const icon = randomDigestIcon();
        iconCounts[icon] = (iconCounts[icon] || 0) + 1;
      }

      const uniqueIconsSeen = Object.keys(iconCounts);
      
      // Should see most of the available icons
      expect(uniqueIconsSeen.length).toBeGreaterThan(DIGEST_ICONS.length * 0.7);
      
      // No single icon should be overly dominant
      const maxCount = Math.max(...Object.values(iconCounts));
      const expectedAverage = iterations / DIGEST_ICONS.length;
      expect(maxCount).toBeLessThan(expectedAverage * 4); // Allow 4x variance (smaller set)
    });
  });

  describe('icon collections content validation', () => {
    it('should have appropriate icons for standup pages', () => {
      // Page icons should be energetic, positive, varied
      expect(PAGE_ICONS).toContain('🌅'); // Morning energy
      expect(PAGE_ICONS).toContain('🚀'); // Progress/launch
      expect(PAGE_ICONS).toContain('🎯'); // Focus/goals
      expect(PAGE_ICONS).toContain('💡'); // Ideas
    });

    it('should have appropriate icons for digest reports', () => {
      // Digest icons should be more report/data focused
      expect(DIGEST_ICONS).toContain('📅'); // Calendar/scheduling
      expect(DIGEST_ICONS).toContain('📊'); // Charts/data
      expect(DIGEST_ICONS).toContain('📋'); // Reports/summaries
    });

    it('should not contain problematic or inappropriate icons', () => {
      // Basic check - no empty strings or problematic content
      [...PAGE_ICONS, ...DIGEST_ICONS].forEach(icon => {
        expect(icon.trim()).toBe(icon); // No whitespace
        expect(icon.length).toBeGreaterThan(0);
        // Could add more specific checks for inappropriate content if needed
      });
    });
  });

  describe('performance characteristics', () => {
    it('should execute randomIcon quickly', () => {
      const start = performance.now();
      
      // Execute many times
      for (let i = 0; i < 10000; i++) {
        randomIcon();
      }
      
      const duration = performance.now() - start;
      
      // Should be very fast (less than 100ms for 10k calls)
      expect(duration).toBeLessThan(100);
    });

    it('should execute randomDigestIcon quickly', () => {
      const start = performance.now();
      
      // Execute many times
      for (let i = 0; i < 10000; i++) {
        randomDigestIcon();
      }
      
      const duration = performance.now() - start;
      
      // Should be very fast
      expect(duration).toBeLessThan(100);
    });
  });
});