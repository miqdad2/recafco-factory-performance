import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run in a zone far from Kuwait (with daylight saving) to prove calculations
    // never depend on the computer's local time zone.
    env: { TZ: 'America/Los_Angeles' },
  },
});
