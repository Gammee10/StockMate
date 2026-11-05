import { describe, it, expect } from 'vitest';
import { validateEnv } from './env';

describe('Environment Configuration Validation', () => {
  it('validates correct environment variables successfully', () => {
    const validConfig = {
      NODE_ENV: 'test',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
      JWT_SECRET: 'super-secret-key-that-is-at-least-32-chars-long!',
    };

    const env = validateEnv(validConfig);
    expect(env.NODE_ENV).toBe('test');
    expect(env.JWT_SECRET).toHaveLength(48);
  });

  it('throws descriptive error if JWT_SECRET is too short', () => {
    const invalidConfig = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
      JWT_SECRET: 'short-key',
    };

    expect(() => validateEnv(invalidConfig)).toThrowError(
      /JWT_SECRET must be at least 32 characters long/
    );
  });

  it('throws descriptive error if DATABASE_URL is missing', () => {
    const missingDbConfig = {
      JWT_SECRET: 'super-secret-key-that-is-at-least-32-chars-long!',
    };

    expect(() => validateEnv(missingDbConfig)).toThrowError(/DATABASE_URL/);
  });
});
