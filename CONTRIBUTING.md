# Contributing to OntoSchema

## Getting set up

```bash
npm install
npm run test:e2e:install   # once, to fetch the Playwright browser
npm run dev
```

`npm run verify` is the gate: typecheck, lint, format check, all three vitest projects,
Playwright against the production build, and the timing suite.

CI runs all of it **except the timing suite**, deliberately. `npm run test:perf` asserts
milliseconds — how long a keystroke blocks the main thread on a 200-class schema — and those
budgets were calibrated on a developer machine with nothing else running. A shared two-core
runner would breach them at random, and a suite that fails at random is a suite people learn
to ignore. Run it locally before anything that touches the canvas, the store or persistence.

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

`npm run test:e2e` runs all three engines; `npm run test:e2e:fast` runs chromium alone, which is
what the pre-push hook and a pull request use.

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

Above all of these: **separation of concerns, clean modularity, and minimal dependencies between
files and modules.** The table above is that principle written down and made enforceable; when a
judgement call is not covered by it, decide the way that leaves fewer edges in the graph.

## Commits, branches and pull requests

One commit is **one cohesive change**. Not two small ones that happened to be in flight together,
and not a refactor riding along with a fix.

| Guide                              | Target                               |
| ---------------------------------- | ------------------------------------ |
| Files touched                      | 2–3                                  |
| Lines changed                      | around 50, **not counting comments** |
| Distinct changes in one commit     | exactly 1                            |
| Distinct features in one branch/PR | exactly 1                            |

The first two are guidelines and there is room to be flexible within reason. Comments do not
count towards the line budget — this codebase explains itself at length on purpose, and a change
should not be split to make room for its own reasoning. Prose and generated files do not count
either, and a rename touching nine files is still one change.

What the numbers are really asking is: **is this one thing, and is it a small amount of
complicated logic?** A diff that is over the guide because it is doing two things is two commits.
A diff that is over because one honest change happens to be that size is fine.

The last two rows are the ones that do not bend. A branch is one feature; a pull request is one
feature. If reviewing it means holding two unrelated ideas at once, it should have been two.

Write the message to explain **why**, in the imperative, with the reasoning below a blank line.
The diff already says what changed.

## A red check is never merged

This is the one rule with no machinery behind it, so it is written down instead.

GitHub does not offer branch protection on a private repository on the Free plan. Nothing stops
a pull request from being merged while its checks are red — the merge button looks exactly the
same either way. **The rule is that you do not press it.**

It is written down because it has already been broken, at a cost worth remembering. A change
turned a text input into a dropdown and updated five kinds of test, but not the end-to-end helper
six other tests went through. CI went red. It was merged anyway. `main` stayed red for a week,
seven unrelated dependency pull requests inherited the failure, and a red check stopped meaning
anything — which is the actual damage. A broken test is cheap. A signal nobody believes is not.

So:

- **Red means stop**, including when the failure looks unrelated to your change. "Unrelated" is a
  diagnosis, not an observation, and it is the one that let the week happen.
- **If `main` is red, fixing it comes before anything else.** Everything merged on top inherits it
  and hides it.
- **A flaky check is a red check** until you have found out why. Playwright reports flakes
  separately; do not skim past them.

Two things make this affordable rather than aspirational. A pull request runs one engine, so the
answer arrives in a few minutes. And `.husky/pre-push` runs that same gate before a branch ever
leaves your machine, so a red pull request is rare enough that stopping for one is not a habit
you have to build.

If this repository ever moves to a paid plan, make CI a required check and delete this section.
An enforced rule beats a remembered one.

## Before you open a pull request

1. `npm run verify` passes.
2. New behaviour has a test at the cheapest tier that can prove it.
3. If you changed the exported RDF, check it still parses: `python scripts/verify_exports.py`
   on the four downloads (needs `pip install rdflib`).
