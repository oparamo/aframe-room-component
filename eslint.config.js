import { basename } from 'node:path';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import sonarjs from 'eslint-plugin-sonarjs';
import importX from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import vitest from '@vitest/eslint-plugin';

// Em dash and Unicode minus. The en dash stays legal: it belongs in numeric ranges like 2023–2025.
const bannedDash = /[\u2014\u2212]/u;

// Nothing built in checks comment text, so this walks every token and comment.
const noEmDash = {
  meta: {
    type: 'problem',
    docs: { description: 'Ban em dashes and Unicode minus signs in code, strings and comments.' },
    messages: { found: 'Remove "{{char}}". Restructure with a comma, colon, semicolon, parentheses or a full stop.' },
    schema: []
  },
  create (context) {
    const { sourceCode } = context;
    return {
      Program () {
        for (const token of [...sourceCode.ast.tokens, ...sourceCode.getAllComments()]) {
          const char = bannedDash.exec(token.value)?.[0];
          if (char) context.report({ loc: token.loc, messageId: 'found', data: { char } });
        }
      }
    };
  }
};

// Basename up to the first dot, so room.test.ts and vite.config.ts are judged as room and vite.
const fileNameCase = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Require camelCase file names.' },
    messages: { notCamelCase: 'Rename "{{name}}" to camelCase.' },
    schema: []
  },
  create (context) {
    return {
      Program (node) {
        const name = basename(context.filename).split('.')[0];
        if (!/^[a-z][a-zA-Z0-9]*$/u.test(name)) context.report({ node, messageId: 'notCamelCase', data: { name } });
      }
    };
  }
};

// A ternary is a value: it may initialize, be assigned, be an arrow's body or a property's value.
const ternaryOutsideValue = 'ConditionalExpression'
  + ':not(VariableDeclarator > ConditionalExpression)'
  + ':not(AssignmentExpression > ConditionalExpression)'
  + ':not(ArrowFunctionExpression > ConditionalExpression)'
  + ':not(Property > ConditionalExpression)';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**'] },
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  stylistic.configs.customize({ semi: true, quotes: 'single', indent: 2, commaDangle: 'never', braceStyle: '1tbs' }),
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
    },
    plugins: {
      sonarjs,
      'import-x': importX,
      local: { rules: { 'no-em-dash': noEmDash, 'file-name-case': fileNameCase } }
    },
    settings: { 'import-x/resolver-next': [createTypeScriptImportResolver()] },
    rules: {
      // Kept from the standard style the code was written in, so formatting doesn't churn.
      '@stylistic/space-before-function-paren': ['error', 'always'],
      '@stylistic/quote-props': ['error', 'as-needed'],

      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      'max-params': ['error', 3],
      'sonarjs/cognitive-complexity': ['error', 6],
      'sonarjs/no-identical-functions': 'error',
      'no-warning-comments': 'error',
      'no-restricted-syntax': ['error',
        { selector: ternaryOutsideValue, message: 'Use a ternary only as a value; branch with if/else otherwise.' },
        // One export list at the bottom of a file shows its public surface in one place.
        { selector: 'ExportNamedDeclaration[declaration]', message: 'Export from one export { } list at the bottom of the file.' }
      ],
      'import-x/no-cycle': 'error',
      // Layers: primitives and components sit on top of systems, and buildingService stays free of A-Frame.
      'import-x/no-restricted-paths': ['error', {
        zones: [
          { target: './src/systems', from: ['./src/components', './src/primitives'] },
          { target: './src/components', from: './src/primitives' },
          { target: './src/systems/buildingService.ts', from: './src/systems/building.ts' }
        ]
      }],
      'local/no-em-dash': 'error',
      'local/file-name-case': 'error'
    }
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked
  },
  {
    files: ['tests/**'],
    ...vitest.configs.recommended,
    rules: {
      ...vitest.configs.recommended.rules,
      // Empty stubs are the point of a mock.
      '@typescript-eslint/no-empty-function': 'off'
    }
  }
);
