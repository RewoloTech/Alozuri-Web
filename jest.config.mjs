import nextJest from 'next/jest.js';
const configure = nextJest({ dir: './apps/web' });
export default configure({
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/jest/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/web/src/$1',
    '^@alozuri/shared$': '<rootDir>/packages/shared/src/index.ts',
  },
  clearMocks: true,
});
