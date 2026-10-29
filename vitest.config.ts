import { defineConfig } from 'vitest/config';

// Unit tests run the pure shared rules and input mapping in Node; they do not
// need the Cloudflare plugin or a browser.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
});
