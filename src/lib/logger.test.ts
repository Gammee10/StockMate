import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, sanitizeContext } from './logger';

describe('Structured Logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('sanitizeContext', () => {
    it('redacts sensitive fields regardless of key casing', () => {
      const input = {
        phone: '+251911000000',
        PIN: '1234',
        password: 'my-super-secret-password',
        pinHash: '$2a$10$hashed_pin',
        token: 'eyJhbGciOi...',
        secret: 'api_secret_key',
        authorization: 'Bearer 12345',
        cookie: 'session_id=abc',
        safeMetadata: 'public_value',
      };

      const result = sanitizeContext(input) as Record<string, unknown>;

      expect(result.phone).toBe('+251911000000');
      expect(result.safeMetadata).toBe('public_value');
      expect(result.PIN).toBe('[REDACTED]');
      expect(result.password).toBe('[REDACTED]');
      expect(result.pinHash).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
      expect(result.secret).toBe('[REDACTED]');
      expect(result.authorization).toBe('[REDACTED]');
      expect(result.cookie).toBe('[REDACTED]');
    });

    it('recursively redacts nested objects and arrays', () => {
      const input = {
        store: {
          id: 'store_1',
          credentials: {
            apiKey: 'secret_key_123',
          },
        },
        items: [
          { name: 'Cooking Oil', priceCents: 25000 },
          { token: 'nested_secret_token' },
        ],
      };

      const result = sanitizeContext(input) as Record<string, unknown>;

      expect(result).toEqual({
        store: {
          id: 'store_1',
          credentials: {
            apiKey: '[REDACTED]',
          },
        },
        items: [{ name: 'Cooking Oil', priceCents: 25000 }, { token: '[REDACTED]' }],
      });
    });

    it('safely handles circular references without infinite loops', () => {
      const cyclic: Record<string, unknown> = { name: 'cyclic-test' };
      cyclic.self = cyclic;

      const result = sanitizeContext(cyclic) as Record<string, unknown>;
      expect(result.name).toBe('cyclic-test');
      expect(result.self).toBe('[CIRCULAR]');
    });
  });

  describe('logger methods', () => {
    it('outputs valid JSON in production environment', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      logger.info('User login successful', { phone: '+251911000000', pin: '4321' });

      expect(consoleSpy).toHaveBeenCalledOnce();
      const loggedJson = JSON.parse(consoleSpy.mock.calls[0][0]);

      expect(loggedJson.level).toBe('info');
      expect(loggedJson.message).toBe('User login successful');
      expect(loggedJson.context.phone).toBe('+251911000000');
      expect(loggedJson.context.pin).toBe('[REDACTED]');
      expect(loggedJson.timestamp).toBeDefined();
    });

    it('routes error level to console.error', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      logger.error('Database connection dropped', { latencyMs: 5000 });

      expect(errorSpy).toHaveBeenCalledOnce();
      const loggedJson = JSON.parse(errorSpy.mock.calls[0][0]);
      expect(loggedJson.level).toBe('error');
      expect(loggedJson.message).toBe('Database connection dropped');
    });

    it('routes warn level to console.warn', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logger.warn('Low stock threshold reached', { stock: 2 });

      expect(warnSpy).toHaveBeenCalledOnce();
      const loggedJson = JSON.parse(warnSpy.mock.calls[0][0]);
      expect(loggedJson.level).toBe('warn');
      expect(loggedJson.message).toBe('Low stock threshold reached');
    });
  });
});
