/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/?(*.)+(test).[cm]js'],
  moduleFileExtensions: ['js', 'mjs', 'cjs', 'json'],
  transform: {},
  moduleNameMapper: {
    '^openai$': '<rootDir>/tests/mocks/openai.js'
  }
};

export default config;


