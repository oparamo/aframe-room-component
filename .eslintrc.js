'use strict';

module.exports = {
  'env': {
    'browser': true,
    'node': true,
    'es2021': true
  },
  'extends': 'eslint:recommended',
  'root': true,
  'rules': {
    'array-bracket-spacing': 2,
    'arrow-parens': 2,
    'arrow-spacing': 2,
    'block-spacing': 2,
    'brace-style': [2, '1tbs', { 'allowSingleLine': true }],
    'comma-dangle': 2,
    'comma-spacing': 2,
    'comma-style': 2,
    'curly': 2,
    'eqeqeq': 2,
    'eol-last': 2,
    'indent': [2, 2],
    'key-spacing': 2,
    'keyword-spacing': 2,
    'linebreak-style': 2,
    'no-trailing-spaces': 2,
    'no-unused-vars': 2,
    'no-console': 0,
    'no-else-return': 2,
    'no-multi-spaces': 2,
    'no-multiple-empty-lines': [2, { 'max': 1, 'maxEOF': 1 }],
    'no-var': 2,
    'object-curly-spacing': [2, 'always'],
    'prefer-arrow-callback': 2,
    'prefer-const': 2,
    'quotes': [2, 'single'],
    'semi': 2
  }
};
