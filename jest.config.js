module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
    '^next/link$': '<rootDir>/__mocks__/next/link.js',
    '^next/image$': '<rootDir>/__mocks__/next/image.js',
    '^next/navigation$': '<rootDir>/__mocks__/next/navigation.js',
    '^next-intl/server$': '<rootDir>/__mocks__/next-intl/server.js',
    '^next-intl/routing$': '<rootDir>/__mocks__/next-intl/routing.js',
    '^@/hooks/useLocalizedMessages$': '<rootDir>/__mocks__/hooks/useLocalizedMessages.js',
    '^@/i18n/routing$': '<rootDir>/__mocks__/next-intl/routing.js',
    '^@/i18n/dictionaries/es.json$': '<rootDir>/__mocks__/i18n/dictionaries/es.json',
    '^@/i18n/dictionaries/en.json$': '<rootDir>/__mocks__/i18n/dictionaries/en.json'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.ts'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        module: 'commonjs'
      }
    }]
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(next|@supabase)/)',
  ],
};