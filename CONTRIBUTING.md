# Contributing to OntoSchema

## Getting set up

```bash
npm install
npm run test:e2e:install   # once, to fetch the Playwright browser
npm run dev
```

`npm run verify` is the gate: typecheck, lint, format check, all three vitest projects, and
Playwright against the production build. CI runs exactly this.

## The architectural rules are enforced, not suggested

`eslint.config.js` encodes the module boundaries. `npm run lint` fails if you break them.

| Layer                   | May import                                | May **not** import              |
| ----------------------- | ----------------------------------------- | ------------------------------- |
| `annotationvocabulary/` | nothing from `src/`                       | everything else                 |
| `ontologymodel/`        | `annotationvocabulary/`                   | React, the store, any UI module |
| `serialization/`        | `ontologymodel/`, `annotationvocabulary/` | React, the store, any UI module |
| `designsystem/`         | nothing from `src/`                       | every other `src/` module       |
| `projectstore/`         | `ontologymodel/`, `annotationvocabulary/` | any UI module                   |
| UI modules              | the layers above                          | **each other**, and `appshell/` |
| `appshell/`             | anything                                  | —                               |

If two UI modules need to agree on something, it belongs in `projectstore/` (see
`dragpayload.ts` and `pendingConnection` for the two existing examples), or the composition
belongs in `appshell/`.

To check the rules still bite, add `import { useProjectStore } from '../projectstore'` to any
file under `src/serialization/` and run `npm run lint`.

## Which test tier to use

| Tier                                     | Command                    | Use it for                                                             |
| ---------------------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| unit (`src/**/*.test.ts`, Node)          | `npm test`                 | the pure domain model and the serializers                              |
| component (`src/**/*.test.tsx`, jsdom)   | `npm run test:component`   | panel behaviour: focus, keyboard, validation, what reaches the store   |
| integration (`tests/integration`, jsdom) | `npm run test:integration` | store → model → all four serializations, parsed back with real parsers |
| e2e (`tests/e2e`, Playwright)            | `npm run test:e2e`         | the canvas, drag and drop, real file downloads                         |

Component tests exist because neither a pure unit test nor an end-to-end test catches focus
and re-render defects economically. If you touch a panel, add one there.

**Do not mock what can run.** The domain model, the serializers, the store and the browser all
run for real. Mocking is for genuine externalities only.

## Conventions

- Directories are named after the **domain function** they perform. No `components/`,
  `utils/`, `helpers/` or `views/`.
- The domain model is pure and framework-free. Anything that imports React does not belong
  in it.
- Comments explain **why**, not what. If a line needs a comment to say what it does, rename
  something instead.
- Commit one logical change at a time, with a message that says why.

## Before you open a pull request

1. `npm run verify` passes.
2. New behaviour has a test at the cheapest tier that can prove it.
3. If you changed the exported RDF, check it still parses: `python scripts/verify_exports.py`
   on the four downloads (needs `pip install rdflib`).
