import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'jsdom' },
  define: { __HIBIRA_BASE__: JSON.stringify('https://hibira.test'), __DEMO__: 'false' },
});
