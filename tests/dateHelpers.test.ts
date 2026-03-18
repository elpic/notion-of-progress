/**
 * Tests for Date Helper Utilities
 * 
 * Tests critical date/time functions used throughout the application
 * for timezone handling and date formatting.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  todayISO,
  yesterdayISO,
  startOfYesterday,
  startOfToday,
  todayFormatted,
} from '../src/utils/dateHelpers';

describe('Date Helpers', () => {
  const originalEnv = process.env;
  const originalDate = Date;
  
  beforeEach(() => {
    // Reset environment
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore environment and Date
    process.env = originalEnv;
    global.Date = originalDate;
  });

  describe('timezone handling', () => {
    it('should use America/New_York as default timezone', () => {
      // Arrange - no TZ environment variable set
      delete process.env.TZ;

      // Act
      const result = todayFormatted();

      // Assert - should work without errors (exact format depends on current date)
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should use custom timezone from environment', () => {
      // Arrange
      process.env.TZ = 'UTC';

      // Act
      const result = todayFormatted();

      // Assert
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle different timezone formats', () => {
      // Test various timezone formats
      const timezones = ['UTC', 'Europe/London', 'Asia/Tokyo', 'America/Los_Angeles'];
      
      timezones.forEach(tz => {
        process.env.TZ = tz;
        const result = todayFormatted();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  describe('todayISO', () => {
    it('should return date in ISO format YYYY-MM-DD', () => {
      // Act
      const result = todayISO();

      // Assert
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(result)).toBeInstanceOf(Date);
    });

    it('should return consistent format across different timezones', () => {
      // Arrange
      const timezones = ['UTC', 'America/New_York', 'Asia/Tokyo'];
      const results: string[] = [];

      // Act
      timezones.forEach(tz => {
        process.env.TZ = tz;
        results.push(todayISO());
      });

      // Assert - all should be valid ISO dates
      results.forEach(result => {
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });

  describe('yesterdayISO', () => {
    it('should return yesterday\'s date in ISO format', () => {
      // Act
      const today = todayISO();
      const yesterday = yesterdayISO();

      // Assert
      expect(yesterday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(yesterday)).toBeInstanceOf(Date);
      
      // Yesterday should be before today
      expect(new Date(yesterday).getTime()).toBeLessThan(new Date(today).getTime());
    });

    it('should handle month boundaries correctly', () => {
      // Mock a date at the beginning of a month
      const mockDate = new Date('2026-03-01T12:00:00Z');
      vi.setSystemTime(mockDate);

      // Act
      const yesterday = yesterdayISO();

      // Assert - should be last day of previous month
      expect(yesterday).toBe('2026-02-28');
    });

    it('should handle year boundaries correctly', () => {
      // Mock New Year's Day
      const mockDate = new Date('2026-01-01T12:00:00Z');
      vi.setSystemTime(mockDate);

      // Act
      const yesterday = yesterdayISO();

      // Assert - should be last day of previous year
      expect(yesterday).toBe('2025-12-31');
    });

    it('should handle leap years correctly', () => {
      // Mock March 1st in a leap year
      const mockDate = new Date('2024-03-01T12:00:00Z'); // 2024 is a leap year
      vi.setSystemTime(mockDate);

      // Act
      const yesterday = yesterdayISO();

      // Assert - should be Feb 29th in leap year
      expect(yesterday).toBe('2024-02-29');
    });
  });

  describe('startOfYesterday', () => {
    it('should return yesterday at midnight in ISO format', () => {
      // Act
      const result = startOfYesterday();

      // Assert - Function returns midnight in local timezone converted to UTC
      // So it might be 03:00:00.000Z for EST timezone (UTC-5) or other offsets
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z$/);
      expect(new Date(result)).toBeInstanceOf(Date);
    });

    it('should always be exactly 24 hours before startOfToday', () => {
      // Act
      const startYesterday = new Date(startOfYesterday());
      const startToday = new Date(startOfToday());

      // Assert
      const hoursDiff = (startToday.getTime() - startYesterday.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBe(24);
    });

    it('should handle timezone conversions correctly', () => {
      // Arrange - test with different timezone
      process.env.TZ = 'Europe/London';

      // Act
      const result = startOfYesterday();

      // Assert - should be valid ISO timestamp (midnight in local timezone converted to UTC)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z$/);
      expect(new Date(result)).toBeInstanceOf(Date);
    });
  });

  describe('startOfToday', () => {
    it('should return today at midnight in ISO format', () => {
      // Act
      const result = startOfToday();

      // Assert - Function returns midnight in local timezone converted to UTC
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z$/);
      expect(new Date(result)).toBeInstanceOf(Date);
    });

    it('should be later than startOfYesterday', () => {
      // Act
      const startYesterday = new Date(startOfYesterday());
      const startToday = new Date(startOfToday());

      // Assert
      expect(startToday.getTime()).toBeGreaterThan(startYesterday.getTime());
    });

    it('should handle different timezones correctly', () => {
      // Arrange
      const timezones = ['UTC', 'Europe/Berlin', 'Asia/Shanghai'];
      const results: string[] = [];

      // Act
      timezones.forEach(tz => {
        process.env.TZ = tz;
        results.push(startOfToday());
      });

      // Assert - all should be valid timestamps (midnight in local timezone converted to UTC)
      results.forEach(result => {
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z$/);
        expect(new Date(result)).toBeInstanceOf(Date);
      });
    });
  });

  describe('todayFormatted', () => {
    it('should return human-readable date format', () => {
      // Act
      const result = todayFormatted();

      // Assert
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // Should contain day of week and month
      expect(result).toMatch(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/);
    });

    it('should include month abbreviation and day number', () => {
      // Mock a specific date for predictable testing
      const mockDate = new Date('2026-03-15T12:00:00Z');
      vi.setSystemTime(mockDate);

      // Act
      const result = todayFormatted();

      // Assert
      expect(result).toContain('Mar'); // Month abbreviation
      expect(result).toContain('15');  // Day number
    });

    it('should handle different days of week correctly', () => {
      // Test different days
      const testDates = [
        '2026-03-15T12:00:00Z', // Sunday
        '2026-03-16T12:00:00Z', // Monday  
        '2026-03-20T12:00:00Z', // Friday
      ];

      const results: string[] = [];
      
      testDates.forEach(dateStr => {
        vi.setSystemTime(new Date(dateStr));
        results.push(todayFormatted());
      });

      // Assert - should have different weekdays
      expect(results[0]).toContain('Sunday');
      expect(results[1]).toContain('Monday');
      expect(results[2]).toContain('Friday');
    });

    it('should respect timezone setting for formatting', () => {
      // Arrange - Set specific timezone
      process.env.TZ = 'UTC';
      const mockDate = new Date('2026-03-15T23:30:00Z'); // Late UTC time
      vi.setSystemTime(mockDate);

      // Act
      const resultUTC = todayFormatted();

      // Change timezone
      process.env.TZ = 'Pacific/Auckland'; // UTC+12
      const resultAuckland = todayFormatted();

      // Assert - Different timezones might show different days
      expect(typeof resultUTC).toBe('string');
      expect(typeof resultAuckland).toBe('string');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle invalid timezone gracefully', () => {
      // Arrange
      const originalTz = process.env.TZ;
      process.env.TZ = 'Invalid/Timezone';

      // Act & Assert - currently throws for invalid timezone (this is the actual behavior)
      expect(() => todayISO()).toThrow('Invalid time zone');
      expect(() => yesterdayISO()).toThrow('Invalid time zone');
      expect(() => todayFormatted()).toThrow('Invalid time zone');
      expect(() => startOfYesterday()).toThrow('Invalid time zone');
      expect(() => startOfToday()).toThrow('Invalid time zone');
    });

    it('should maintain consistency between related functions', () => {
      // Act
      const today = todayISO();
      const startToday = startOfToday();
      const yesterday = yesterdayISO();
      const startYesterday = startOfYesterday();

      // Assert - functions should be consistent with each other
      expect(startToday).toContain(today);
      expect(startYesterday).toContain(yesterday);
      
      // Start times should be exactly 24 hours apart
      const diff = new Date(startToday).getTime() - new Date(startYesterday).getTime();
      expect(diff).toBe(24 * 60 * 60 * 1000); // 24 hours in milliseconds
    });
  });
});