module.exports = {
  root: true,
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname
  },
  extends: ['standard-with-typescript', 'plugin:react/recommended', 'plugin:react-hooks/recommended'],
  plugins: ['react-refresh'],
  env: {
    browser: true,
    es2022: true
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off'
  }
};

