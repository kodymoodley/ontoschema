// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The module boundaries are only as real as the lint rules that enforce them, and a rule that
 * stops matching fails silently: the build goes on passing while it checks nothing. So this
 * writes files that cross each boundary, lints them with the project's own `.oxlintrc.json`,
 * and asserts that every crossing is reported with its own layer's message -- and that the
 * imports the architecture allows are not.
 *
 * The probes live in a scratch directory, never in `src/`. The config is copied beside them
 * because its `files` globs resolve against the directory the config sits in.
 */

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OXLINT = join(
  dirname(createRequire(import.meta.url).resolve('oxlint/package.json')),
  'bin',
  'oxlint',
);

const UI_MODULES = [
  'canvas',
  'classeditor',
  'relationeditor',
  'taxonomytree',
  'annotationpanel',
  'ontologymetadata',
  'exportpanel',
  'projectswitcher',
  'entitysearch',
];

const FRAMEWORK =
  'The domain layer must stay framework-agnostic: no React, canvas or store imports here.';
const COMPOSITION = 'Composition flows downward: a UI module must not import appshell/.';
const sibling = (module: string) =>
  `UI modules are self-contained: ${module}/ must not import a sibling UI module. Share through projectstore/ or compose in appshell/.`;

interface Probe {
  /** Where the importing file sits, relative to the project root. */
  file: string;
  /** The module specifier it imports. */
  imports: string;
}

interface Forbidden extends Probe {
  /** The message the layer's rule gives, so a match proves the right rule fired. */
  message: string;
}

const FORBIDDEN: Forbidden[] = [
  {
    file: 'src/ontologymodel/probe.ts',
    imports: 'zustand',
    message: FRAMEWORK,
  },
  {
    file: 'src/annotationvocabulary/probe.ts',
    imports: '../projectstore',
    message: 'The domain layer must not depend on UI or app-state modules.',
  },
  {
    file: 'src/examplelibrary/probe.ts',
    imports: '../canvas',
    message: 'examplelibrary/ builds ontologies; it must not reach into UI or app state.',
  },
  {
    file: 'src/serialization/probe.ts',
    imports: '../projectstore',
    message: 'Serialization depends on the domain model only, never on UI or app state.',
  },
  {
    file: 'src/search/probe.ts',
    imports: '../appshell/App',
    message:
      'Search depends on the domain model only, so the same ranking can serve an imported vocabulary later.',
  },
  {
    file: 'src/designsystem/probe.tsx',
    imports: '../serialization',
    message: 'designsystem/ is a leaf: it must not import other src/ modules.',
  },
  {
    file: 'src/filelink/probe.ts',
    imports: '../projectswitcher',
    message:
      'filelink/ keeps schemas and their files in step. It serves the UI and may not import it: no UI module, appshell/ or designsystem/.',
  },
  {
    file: 'src/serialization/to-filelink.ts',
    imports: '../filelink',
    message: 'Serialization depends on the domain model only, never on UI or app state.',
  },
  // Every UI module against every sibling, both through the sibling's index and past it.
  ...UI_MODULES.flatMap((self) =>
    UI_MODULES.filter((other) => other !== self).flatMap((other) => [
      { file: `src/${self}/to-${other}.ts`, imports: `../${other}`, message: sibling(self) },
      {
        file: `src/${self}/into-${other}.ts`,
        imports: `../${other}/inner`,
        message: sibling(self),
      },
    ]),
  ),
  ...UI_MODULES.map((self) => ({
    file: `src/${self}/to-appshell.tsx`,
    imports: '../appshell',
    message: COMPOSITION,
  })),
];

const ALLOWED: Probe[] = [
  { file: 'src/ontologymodel/allowed.ts', imports: '../annotationvocabulary' },
  { file: 'src/serialization/allowed.ts', imports: '../ontologymodel' },
  { file: 'src/canvas/allowed.ts', imports: '../projectstore' },
  { file: 'src/filelink/allowed-store.ts', imports: '../projectstore' },
  { file: 'src/filelink/allowed-serializer.ts', imports: '../serialization' },
  { file: 'src/projectswitcher/allowed-filelink.ts', imports: '../filelink' },
  { file: 'src/canvas/allowed-react.tsx', imports: '@xyflow/react' },
  { file: 'src/appshell/allowed.tsx', imports: '../canvas' },
  // Tests reach across boundaries on purpose, to build the state they check.
  { file: 'src/serialization/allowed.test.ts', imports: '../projectstore' },
  { file: 'tests/integration/allowed.ts', imports: '../../src/canvas' },
];

interface Diagnostic {
  code: string;
  filename: string;
  help?: string;
}

let workspace: string;
let restricted: Diagnostic[];

beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), 'ontoschema-lint-'));
  copyFileSync(join(REPO_ROOT, '.oxlintrc.json'), join(workspace, '.oxlintrc.json'));
  for (const { file, imports } of [...FORBIDDEN, ...ALLOWED]) {
    mkdirSync(dirname(join(workspace, file)), { recursive: true });
    writeFileSync(
      join(workspace, file),
      `import { probe } from '${imports}';\nexport const used = probe;\n`,
    );
  }

  const run = spawnSync(process.execPath, [OXLINT, '-c', '.oxlintrc.json', '-f', 'json', '.'], {
    cwd: workspace,
    encoding: 'utf8',
  });
  const { diagnostics } = JSON.parse(run.stdout) as { diagnostics: Diagnostic[] };
  restricted = diagnostics
    .filter((d) => d.code === 'eslint(no-restricted-imports)')
    .map((d) => ({ ...d, filename: d.filename.replaceAll('\\', '/') }));
});

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

const reportsFor = (file: string) => restricted.filter((d) => d.filename === file);

describe('the module boundaries in .oxlintrc.json', () => {
  it.each(FORBIDDEN)('rejects $imports from $file', ({ file, message }) => {
    expect(reportsFor(file).map((d) => d.help)).toEqual([message]);
  });

  it.each(ALLOWED)('accepts $imports from $file', ({ file }) => {
    expect(reportsFor(file)).toEqual([]);
  });
});
