import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Architectural boundaries are enforced here, not merely documented in the README.
 *
 *   annotationvocabulary  leaf, pure data
 *   ontologymodel         pure; may use annotationvocabulary only
 *   serialization         pure; may use ontologymodel + annotationvocabulary only
 *   designsystem          leaf UI primitives; imports nothing from src/
 *   projectstore          app state; may use ontologymodel + annotationvocabulary
 *   <ui modules>          may use the layers above, never each other
 *   appshell              the single composition point, may import anything
 *
 * `npm run lint` fails if any of these is violated. To confirm the rules still bite, add
 * `import { useProjectStore } from '../projectstore'` to a file in src/serialization/.
 */

const UI_MODULES = [
  'canvas',
  'classeditor',
  'relationeditor',
  'taxonomytree',
  'annotationpanel',
  'ontologymetadata',
  'exportpanel',
  'projectswitcher',
];

/**
 * Both spellings are needed: `../projectstore` resolves through the module's index and
 * does not match a `**\/projectstore/**` glob on its own.
 */
const moduleGlobs = (names) => names.flatMap((name) => [`**/${name}`, `**/${name}/**`]);

const FRAMEWORK_PACKAGES = [
  'react',
  'react-dom',
  'react/*',
  'react-dom/*',
  '@xyflow/react',
  '@xyflow/*',
  'zustand',
  'zustand/*',
];

const APP_LAYER_MODULES = [...UI_MODULES, 'projectstore', 'designsystem', 'appshell'];

const pureLayerRule = (message) => [
  'error',
  {
    patterns: [
      {
        group: FRAMEWORK_PACKAGES,
        message:
          'The domain layer must stay framework-agnostic: no React, canvas or store imports here.',
      },
      { group: moduleGlobs(APP_LAYER_MODULES), message },
    ],
  },
];

/** A UI module may not import any sibling UI module; it goes through the store or appshell. */
const uiSiblingBoundaries = UI_MODULES.map((self) => ({
  files: [`src/${self}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: moduleGlobs(UI_MODULES.filter((other) => other !== self)),
            message: `UI modules are self-contained: ${self}/ must not import a sibling UI module. Share through projectstore/ or compose in appshell/.`,
          },
          {
            group: moduleGlobs(['appshell']),
            message: 'Composition flows downward: a UI module must not import appshell/.',
          },
        ],
      },
    ],
  },
}));

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'node_modules'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  {
    files: ['src/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  {
    files: ['src/ontologymodel/**/*.ts', 'src/annotationvocabulary/**/*.ts'],
    rules: {
      'no-restricted-imports': pureLayerRule(
        'The domain layer must not depend on UI or app-state modules.',
      ),
    },
  },

  {
    files: ['src/serialization/**/*.ts'],
    rules: {
      'no-restricted-imports': pureLayerRule(
        'Serialization depends on the domain model only, never on UI or app state.',
      ),
    },
  },

  {
    files: ['src/designsystem/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: moduleGlobs([
                ...APP_LAYER_MODULES.filter((name) => name !== 'designsystem'),
                'ontologymodel',
                'annotationvocabulary',
                'serialization',
              ]),
              message: 'designsystem/ is a leaf: it must not import other src/ modules.',
            },
          ],
        },
      ],
    },
  },

  ...uiSiblingBoundaries,

  {
    files: ['tests/**/*.ts', '**/*.test.ts', '**/*.test.tsx'],
    rules: { 'no-restricted-imports': 'off', 'no-console': 'off' },
  },

  // Build scripts are Node programs, not browser or app code.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
);
