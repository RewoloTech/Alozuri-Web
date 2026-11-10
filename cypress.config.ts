import { defineConfig } from 'cypress';

export default defineConfig({
  video: false,
  screenshotOnRunFailure: true,
  screenshotsFolder: 'test-results/cypress/screenshots',
  videosFolder: 'test-results/cypress/videos',
  viewportWidth: 1280,
  viewportHeight: 900,
  e2e: {
    baseUrl: 'http://localhost:3100',
    specPattern: 'tests/cypress/e2e/**/*.cy.ts',
    supportFile: 'tests/cypress/support/e2e.ts',
  },
});
