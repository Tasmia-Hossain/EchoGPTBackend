import 'reflect-metadata';
import { validate } from './env.validation';

const validConfig = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/echogpt',
  JWT_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  PORT: '3000',
  AI_PROVIDER_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef',
};

describe('environment CORS origin validation', () => {
  it('trims entries and ignores empty origins', () => {
    const config = validate({
      ...validConfig,
      CORS_ORIGINS: ' http://localhost:3000, , https://app.example.com/ ',
    });

    expect(config.CORS_ORIGINS).toBe(
      'http://localhost:3000,https://app.example.com',
    );
  });

  it('accepts an explicitly configured Chrome extension origin', () => {
    const extensionOrigin = `chrome-extension://${'a'.repeat(32)}`;

    const config = validate({ ...validConfig, CORS_ORIGINS: extensionOrigin });

    expect(config.CORS_ORIGINS).toBe(extensionOrigin);
  });

  it('rejects wildcard origins', () => {
    expect(() =>
      validate({ ...validConfig, CORS_ORIGINS: '*' }),
    ).toThrow(/CORS_ORIGINS/);
  });

  it('rejects entries containing a path', () => {
    expect(() =>
      validate({
        ...validConfig,
        CORS_ORIGINS: 'https://app.example.com/dashboard',
      }),
    ).toThrow(/CORS_ORIGINS/);
  });

  it('requires at least one non-empty origin', () => {
    expect(() => validate({ ...validConfig, CORS_ORIGINS: ' , ' })).toThrow(
      /CORS_ORIGINS/,
    );
  });
});
