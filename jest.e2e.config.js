// End-to-end tests against the real Supabase project: plain Node environment
// (jest-expo replaces fetch with React Native's polyfill, which can't do real HTTP).
// Run: npm run test:e2e  (needs .env.local)
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.e2e.test.ts'],
  // babel-preset-expo rewrites process.env.EXPO_PUBLIC_* to an ESM import of expo/virtual/env
  transformIgnorePatterns: ['node_modules/(?!expo/virtual/)'],
};
