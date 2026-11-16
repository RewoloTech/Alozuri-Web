import nextJest from 'next/jest.js';
const configure = nextJest({ dir: './apps/web' });
const createConfig = configure({
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/jest/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/web/src/$1',
    '^@alozuri/shared$': '<rootDir>/packages/shared/src/index.ts',
  },
  clearMocks: true,
});
const jestConfig = async () => {
  const config = await createConfig();
  return {
    ...config,
    // next-intl and its ICU runtime are ESM. Compile their real implementation
    // for Jest's CommonJS runner rather than mocking translation behaviour.
    transformIgnorePatterns: [
      '/node_modules/(?!(@alozuri/shared|next-intl|use-intl|intl-messageformat|@formatjs|icu-minify)/)',
      '^.+\\.module\\.(css|sass|scss)$',
    ],
  };
};
export default jestConfig;
