/**
 * Tests for Logger Utility
 * 
 * Tests the logging functionality and run logger creation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create run logger with random ID', async () => {
    const { createRunLogger } = await import('../src/utils/logger');
    
    const logger = createRunLogger();
    
    // Test that logger has all required methods
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();  
    expect(logger.error).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should log info messages with timestamp and ID', async () => {
    const { createRunLogger } = await import('../src/utils/logger');
    
    const logger = createRunLogger();
    logger.info('Test message');
    
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]\[[A-Z0-9]{6}\] INFO  Test message$/)
    );
  });

  it('should log warn messages with timestamp and ID', async () => {
    const { createRunLogger } = await import('../src/utils/logger');
    
    const logger = createRunLogger();
    logger.warn('Warning message');
    
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]\[[A-Z0-9]{6}\] WARN  Warning message$/)
    );
  });

  it('should log error messages with timestamp and ID', async () => {
    const { createRunLogger } = await import('../src/utils/logger');
    
    const logger = createRunLogger();
    logger.error('Error message');
    
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]\[[A-Z0-9]{6}\] ERROR Error message$/)
    );
  });

  it('should use consistent ID across multiple calls', async () => {
    const { createRunLogger } = await import('../src/utils/logger');
    
    const logger = createRunLogger();
    logger.info('Message 1');
    logger.warn('Message 2');
    logger.error('Message 3');
    
    const calls = [
      (console.log as any).mock.calls[0][0],
      (console.warn as any).mock.calls[0][0],
      (console.error as any).mock.calls[0][0],
    ];
    
    // Extract IDs from log messages
    const ids = calls.map(call => {
      const match = call.match(/\[([A-Z0-9]{6})\]/);
      return match ? match[1] : null;
    });
    
    // All should have the same ID
    expect(ids[0]).toBe(ids[1]);
    expect(ids[1]).toBe(ids[2]);
    expect(ids[0]).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('should generate different IDs for different loggers', async () => {
    const { createRunLogger } = await import('../src/utils/logger');
    
    const logger1 = createRunLogger();
    const logger2 = createRunLogger();
    
    logger1.info('Message from logger 1');
    logger2.info('Message from logger 2');
    
    const call1 = (console.log as any).mock.calls[0][0];
    const call2 = (console.log as any).mock.calls[1][0];
    
    const id1 = call1.match(/\[([A-Z0-9]{6})\]/)?.[1];
    const id2 = call2.match(/\[([A-Z0-9]{6})\]/)?.[1];
    
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^[A-Z0-9]{6}$/);
    expect(id2).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('should use default logger for general logging', async () => {
    const { logger } = await import('../src/utils/logger');
    
    logger.info('Default logger message');
    
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]\[[A-Z0-9]{6}\] INFO  Default logger message$/)
    );
  });

  it('should handle messages with special characters', async () => {
    const { createRunLogger } = await import('../src/utils/logger');
    
    const logger = createRunLogger();
    const specialMessage = 'Message with "quotes" and symbols: @#$%^&*()';
    
    logger.info(specialMessage);
    
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(specialMessage)
    );
  });

  it('should handle empty messages', async () => {
    const { createRunLogger } = await import('../src/utils/logger');
    
    const logger = createRunLogger();
    
    logger.info('');
    logger.warn('');
    logger.error('');
    
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]\[[A-Z0-9]{6}\] INFO  $/)
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]\[[A-Z0-9]{6}\] WARN  $/)
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]\[[A-Z0-9]{6}\] ERROR $/)
    );
  });
});