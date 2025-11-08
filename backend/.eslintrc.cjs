module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  extends: ['standard'],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 'latest'
  },
  rules: {
    'no-console': 'warn'
  }
};

