# Technical debt audit

Repository state audited: `main` at `c55d0f9`, working tree clean.
Method: read-only sweep of `src/`, `tests/`, `scripts/` and root configuration (~31,600 lines),
plus mechanical scans for dead exports, type escapes, weak assertions and duplicated logic.
Baseline before the audit: typecheck **pass**, lint **pass**, `test:node` **878 passing**.

## 1. Executive summary

This is a disciplined codebase, and the audit should say so plainly rather than manufacture
balance: there are no `TODO`/`FIXME` markers, no `any`, no `@ts-ignore`, no skipped tests, no
non-null assertions in production code, no unused dependencies, no secrets, and the architectural
layering is enforced by ESLint rather than described in a README. Error paths in persistence are
deliberate and commented. 878 node-level tests and ~150 end-to-end specs run on three engines.

What is wrong is concentrated almost entirely in **prose**, and the cause is structural: every
other property of this repository is gated by CI — types, lint, formatting, coverage, bundle size,
behaviour on three browsers — and **nothing gates a sentence**. Every documentation finding below
is a claim that was true when it was written and was not revisited when the code moved underneath
it. The three that worry me most: the README's walkthrough describes an inspector that was
dismantled weeks ago; the README's account of the exported file contradicts the exporter as of two
commits ago; and two tests pass when the thing they are testing has vanished entirely.

Would I trust it in production? Yes. "Production" here is a static site with no backend, no
network calls and no data leaving the browser, so the blast radius of everything below is a
confused reader or a false sense of test coverage, not a corrupted schema or a leaked secret.
No S1 findings.

## 2. Findings

| ID  | Sev | Conf   | Category    | Location                                                                                            | Finding                                                                                                                                                                                                                                                                                                            | Proposed fix                                                       | Blast radius | Status |
| --- | --- | ------ | ----------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------ | ------ |
| E1  | S3  | High   | Docs        | `README.md:50-60`                                                                                   | Describes `rdfs:domain`/`rdfs:range` "on every property" and an anonymous `owl:unionOf` for reused ones. Since todo 36 a saved file states neither and writes no union.                                                                                                                                            | Rewrite the two sections against the current writer                | 1 file       | FIXED  |
| E2  | S3  | High   | Docs        | `README.md:112-126`                                                                                 | The walkthrough instructs the reader to use **Details**, **Annotations**, **Ontology** and **Export** tabs in the inspector, and a **Data props** tab in the left panel. None of these exist.                                                                                                                      | Rewrite the walkthrough against the current UI                     | 1 file       | FIXED  |
| E3  | S3  | High   | Docs        | `README.md:147-157`                                                                                 | Command table lists `npm run test:unit-and-integration`, which does not exist; describes `test:e2e` as starting a dev server when it serves the production build; mis-describes `verify`; omits 11 real scripts.                                                                                                   | Regenerate the table from `package.json`                           | 1 file       | FIXED  |
| E4  | S3  | High   | Docs        | `src/projectstore/persistence.ts:9-11`                                                              | "Deliberately the only place that knows about localStorage" — three other modules call it directly.                                                                                                                                                                                                                | Correct the comment, or move the preference stores behind it       | 1–4 files    | FIXED  |
| E5  | S4  | High   | Docs        | `PLAN.md`, `claude-code-prompt.md`                                                                  | Two completed/obsolete process documents tracked at the repo root. `PLAN.md:5-7` states "162 unit+integration tests" and "zero component tests"; both are long superseded.                                                                                                                                         | Delete, or move under `docs/history/`                              | 2 files      | FIXED  |
| C1  | S3  | High   | Dead code   | `src/ontologymodel/ontology.ts`, `src/annotationvocabulary/datatypes.ts:22`                         | Five exported functions with zero callers in `src/` **or** `tests/`: `findUsage`, `hasUnambiguousDomain`, `relationUsagesOfClass`, `resolveUsage`, `xsdDatatypeCurie`.                                                                                                                                             | Delete, with their re-exports                                      | 4 files      | FIXED  |
| C2  | S3  | High   | Dead code   | `src/ontologymodel/identifier.ts:19-33`                                                             | `validateLocalName` has had no caller since `3c47a5c` and carries **17 references across two test files**, which make it look live. The UI sanitises with `toClassLocalName` instead.                                                                                                                              | Delete both, or wire it into `NameInput`                           | 3 files      | FIXED  |
| C4  | S3  | High   | Correctness | `src/ontologymodel/identifier.ts:9`                                                                 | **Found while deciding C2.** The "starts with a letter" guard is `/^[A-Za-z_]/`, so a name in any non-Latin script is prefixed with `_`: `日本語クラス` becomes `_日本語クラス`. XML and NCName both allow those letters.                                                                                          | Widen the guard to the NCName start set                            | 1 file       | OPEN   |
| C3  | S3  | High   | Duplication | `src/exportpanel/download.ts:6` vs `src/projectswitcher/ProjectSwitcher.tsx:68`                     | The browser-download helper exists twice, and the copies have **diverged**: the second omits `anchor.rel = 'noopener'`.                                                                                                                                                                                            | Move one copy to `designsystem/`, delete the other                 | 3 files      | FIXED  |
| D1  | S3  | High   | Drift       | `useThemePreference.ts`, `usePanelPreference.ts`, `annotationpanel/showterms.ts`                    | Three implementations of "a per-browser preference in localStorage", in three different shapes (state+effect, state+effect+Set, module store + `useSyncExternalStore`), each repeating the same try/catch.                                                                                                         | One helper, three callers                                          | 4 files      | FIXED  |
| G1  | S2  | High   | Tests       | `src/annotationpanel/AnnotationEditor.test.tsx:234`, `src/ontologymodel/mutations.test.ts:344-346`  | Two assertions pass when the subject has vanished: `expect(x[0]?.language).toBeUndefined()` succeeds if `x[0]` is `undefined`. The second also defaults the id with `?? ''`, so a missing fixture would make the whole test vacuous — and it turned out to be asserting on an arbitrary first-of-four annotations. | Assert the annotation still exists, then that its language is gone | 2 files      | FIXED  |
| G2  | S4  | High   | Tests       | `src/ontologymodel/fromTriples.test.ts:226`                                                         | `expect(ids).toBeDefined()` — a tautology added to consume an unused variable. Cannot fail.                                                                                                                                                                                                                        | Delete the line and the unused destructure                         | 1 file       | FIXED  |
| G3  | S3  | High   | Tests       | `stryker.config.json:9`                                                                             | Mutation testing is scoped to `src/serialization/*.ts` — one module of seventeen. Coverage percentages elsewhere are unvalidated by mutation.                                                                                                                                                                      | Widen the scope module by module                                   | 1 file       | FIXED  |
| G4  | S3  | High   | Tests       | `src/ontologymodel/ontology.ts`, `fromTriples.ts`                                                   | **Found by fixing G3.** The model scores **77.2%** on mutation testing against a 92% line-coverage threshold, with **95 mutants not covered at all**. `ontology.ts` is 63.2%, `fromTriples.ts` 68.9%.                                                                                                              | Kill the survivors file by file, worst first                       | many         | OPEN   |
| F1  | S4  | Medium | Interface   | `src/ontologymodel/fromTriples.ts` (16 sites)                                                       | 16 `x.get(k) as string` casts. Each is safe today because the key came from the list that filled the map, but the cast silences the compiler if that ever stops being true.                                                                                                                                        | Non-null via a lookup helper that throws                           | 1 file       | FIXED  |
| H1  | S3  | High   | Config      | `scripts/checkBundleSize.mjs`                                                                       | The total budget is 205 kB and the bundle is **204.8 kB**. The next change of any size fails the gate.                                                                                                                                                                                                             | Raise deliberately with a recorded reason, or trim                 | 1 file       | FIXED  |
| E6  | S3  | High   | Docs        | `README.md:150-152`                                                                                 | **Found while fixing E2.** "Subclass links stay vertical whichever way round the two sit" — the schema canvas has drawn no subclass links since `814e26a`.                                                                                                                                                         | Rewrite the sentence                                               | 1 file       | FIXED  |
| S1x | S4  | High   | Copy        | `src/canvas/Palette.tsx:65`, `src/canvas/SchemaCanvas.tsx:174`, `src/classeditor/ClassNode.tsx:116` | User-visible text reads "a attribute". Introduced by the bulk rename in `5003a82`, which changed the noun and not the article.                                                                                                                                                                                     | Fix the three strings                                              | 3 files      | FIXED  |

### Swept and found clean

- **A. Correctness.** No swallowed exceptions beyond deliberate, commented ones; no unhandled
  rejections; no `any`; zero non-null assertions in production code. `savequeue.ts` was read line
  by line — debounce with a hard ceiling, timer cleared on flush, `pending` cleared before the
  write so a throwing write cannot re-throw forever, and flushed on both `pagehide` and
  `visibilitychange`. Correct.
- **B. Robustness.** Every trust boundary validates: `loadWorkspace`, `workspaceFromFile` and
  `projectFromFile` all parse defensively and fall back rather than throwing; file import runs
  through `ontologyFromTriples` with a drop report. No env vars, no network, no timeouts to get
  wrong.
- **H. Dependencies.** All seven production dependencies are used. No secrets. Dependabot is
  configured. No environment drift — there is one environment.
- **I. Performance.** No queries, so no N+1; no synchronous I/O on a hot path. A perf suite with
  frame budgets exists and passes locally. Nothing structural to report.

## 3. Detail

### E1 — the README contradicts the exporter

`README.md:50-56`:

> Class and property declarations, subclass and subproperty hierarchies, and `rdfs:domain`/`rdfs:range`
> on every property. A property used on one class states that class directly; one used on several
> states an **anonymous `owl:unionOf`** over all of them.

And `README.md:42-47`:

> **File › Save a schema** writes a document this app can open again … carrying the OWL/RDFS axioms
> and where the classes sit on the canvas.
> **File › Export** writes what cannot be read back: the SHACL shapes as a file of their own …

Since `fdc2ea4` (todo 36) a saved file carries its SHACL shapes, the reader reads them back, and
a reused property states **no** domain or range and **no** union — `src/ontologymodel/triples.ts`
only writes the union when `includeShapes` is false. So three claims are now false: what a saved
file contains, that shapes cannot be read back, and that a union is written.

**Why it matters here:** this section is the tool's explanation of its own output format. Someone
reading it to understand a `.ttl` this app produced will look for a `owl:unionOf` that is not
there, and will not expect the `sh:NodeShape` blocks that are.

**Fix:** rewrite `README.md:40-75` against the current writer. **Risk:** none — prose only.

### E2 — the walkthrough describes a UI that was dismantled

`README.md:112-126` tells the reader to use the inspector's **Details** tab, the **Annotations**
tab, the **Ontology** tab and the **Export** tab, and a **Data props** tab in the left panel.

The inspector has had no tab strip since todos 23–27. `src/appshell/Inspector.tsx:53,57` renders
two headings, `Details` and `Documentation`, in one scrolling panel. Export moved to the file
menu; schema metadata is a dialog opened from the header. The left panel's tabs are
`Class` / `Relation` / `Attribute` (`src/taxonomytree/HierarchyTree.tsx:40-42`).

**Why it matters here:** this is the "try it in five minutes" section — the first thing a new user
follows, and every numbered step after the second one names a control that does not exist.

**Fix:** rewrite the walkthrough. **Risk:** none — prose only.

### E3 — the command table would fail on a clean machine

`README.md:147-157` lists `npm run test:unit-and-integration`. There is no such script; the
closest is `test:node`. `npm run test:e2e` is described as "starts its own dev server" — it runs
`npm run build && npx vite preview` (`playwright.config.ts:58-62`), which is the entire point of
that change and is what CI's own comment brags about. `npm run verify` is described as "Everything
CI runs", but it runs `test:perf`, which CI deliberately excludes, and omits coverage, which CI
enforces. Eleven real scripts appear nowhere: `format:check`, `lint:fix`, `test:watch`,
`test:component`, `test:node`, `test:e2e:fast`, `test:perf`, `mutation`, `size`,
`languages:refresh`, `icons:refresh`.

**Why it matters here:** a contributor following `CONTRIBUTING.md` reaches for these commands
first, and one of them does not exist.

**Fix:** regenerate the table from `package.json`. **Risk:** none.

### E4 — an architectural promise the code does not keep

`src/projectstore/persistence.ts:9-11`:

> Browser-local persistence. Deliberately the only place that knows about localStorage, so
> swapping in a real backend later means replacing this file and nothing else.

Three other modules call `localStorage` directly: `src/appshell/useThemePreference.ts:15,29`,
`src/appshell/usePanelPreference.ts:43,73`, `src/annotationpanel/showterms.ts:21,39`.

**Why it matters here:** the comment states a migration guarantee. It is wrong about the guarantee
in a small way — the three strays hold browser preferences rather than schema data — but a reader
planning that migration would trust the sentence rather than grep.

**Fix:** either narrow the claim to "the only place that persists _the workspace_", or route the
three preference stores through this module. The first is one line; the second is D1.

### C1 — five exported functions with no callers

`findUsage`, `hasUnambiguousDomain`, `relationUsagesOfClass` and `resolveUsage` are exported from
`src/ontologymodel/ontology.ts` and re-exported from `src/ontologymodel/index.ts`. A whole-repo
scan for each name returns only the declaration and the re-export — no callers in `src/`, none in
`tests/`. `xsdDatatypeCurie` (`src/annotationvocabulary/datatypes.ts:22`) joined them two commits
ago, when the display sites moved to `xsdDatatypeLabel`.

**Why it matters here:** `ontologymodel` is the layer every other module reads. Four unused query
helpers in its public surface are four things a reader has to decide are irrelevant.

**Fix:** delete them and their re-exports. **Risk:** none — nothing calls them; the typecheck
proves it.

### C2 — dead code with tests that make it look alive

`src/ontologymodel/identifier.ts:19-33` validates a local name: empty, illegal characters, NCName
start, with tailored messages. Nothing calls it. The last caller went in `3c47a5c`. The UI takes
the opposite approach — `src/classeditor/ClassDetails.tsx:65` sanitises with `toClassLocalName`
and only rejects the empty result:

```tsx
validate={(value) => (toClassLocalName(value) === '' ? 'A class needs a name.' : undefined)}
```

Meanwhile `validateLocalName` is referenced 17 times — 15 in `identifier.test.ts`,
2 in `examples.test.ts`.

**Why it matters here:** this is the most misleading shape a piece of dead code can take. Coverage
counts it, tests exercise it, and a reader would reasonably conclude that names are validated the
way its messages say. They are not — they are rewritten.

**Fix:** delete the function and its tests, **or** wire it into `NameInput` and keep them. That is
a product decision (reject bad names vs. silently fix them), not a cleanup, so it needs an answer
before either move.

### C3 — a copied helper that has diverged

`src/exportpanel/download.ts:6-18` and `src/projectswitcher/ProjectSwitcher.tsx:68-78` are the same
eleven lines. The second omits `anchor.rel = 'noopener'` and the comment explaining why the revoke
is deferred a tick.

The copy exists because the boundary rule forbids it: `eslint.config.js:76` stops one UI module
importing another, and there is no shared home for DOM plumbing below them.

**Why it matters here:** the practical divergence is minor — `noopener` on a same-origin blob
download is belt and braces. The pattern is not minor: the rule that keeps this codebase tidy is
also the rule that quietly encourages copying, and this is the copy that proves it.

**Fix:** move `downloadFile` into `designsystem/`, which both may import, and delete the copy.
**Risk:** low. `designsystem` currently imports nothing from `src/`, and this stays true — it is a
leaf function with no dependencies.

### D1 — three shapes for one concern

| File                                 | Shape                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `src/appshell/useThemePreference.ts` | `useState` + effect, key `ontoschema.theme`                                               |
| `src/appshell/usePanelPreference.ts` | `useState` + effect + `Set` serialisation, key `ontoschema.panels`                        |
| `src/annotationpanel/showterms.ts`   | module-level variable + `useSyncExternalStore` + listener set, key `ontoschema.showTerms` |

All three read on init, write on change, and wrap both in the same try/catch for private-browsing
mode. Only the third is shared across components, which is the one real reason to differ.

**Why it matters here:** the next preference will copy whichever file its author opens first. This
is also the mechanism behind E4.

**Fix:** one `usePreference(key, parse, serialise)` (or a small store factory) in `projectstore`,
with the three as callers. **Risk:** low, but it touches persistence-adjacent code, so it wants its
own batch and a run of the store tests.

### G1 — two tests that pass when the subject is missing

`src/ontologymodel/mutations.test.ts:342-347`:

```ts
it('clears the language tag when set to empty', () => {
  const { ontology, ids } = buildAutoOntology();
  const id = findClass(ontology, ids.car)?.annotations[0]?.id ?? '';
  const cleared = updateAnnotation(ontology, 'class', ids.car, id, { language: '' });
  expect(findClass(cleared, ids.car)?.annotations[0]?.language).toBeUndefined();
});
```

If `updateAnnotation` deleted the annotation instead of clearing its tag, `annotations[0]` would be
`undefined`, `?.language` would be `undefined`, and the assertion would **pass**. If the fixture
ever stopped carrying an annotation, `id` would be `''`, the call would be a no-op, and the test
would still pass — asserting nothing at all. `src/annotationpanel/AnnotationEditor.test.tsx:234`
has the same first weakness.

**Why it matters here:** these guard the language-tag behaviour that the RDF writers depend on for
`@en` literals, and they are precisely the kind of test that reports success while the feature
rots.

**Fix:** assert the annotation still exists first — `expect(annotations).toHaveLength(1)` — then
assert `language` is undefined. **Risk:** none; if the fix makes them fail, that is the finding.

### G2 — an assertion that cannot fail

`src/ontologymodel/fromTriples.test.ts:226`: `expect(ids).toBeDefined();` — `ids` is destructured
from `buildAutoOntology()` and is always an object. It was added to consume an otherwise unused
variable. **Fix:** drop the line and stop destructuring `ids`.

### G3 — mutation testing covers one module of seventeen

`stryker.config.json:9` mutates `src/serialization/*.ts` only. Everything else — the model,
the store, the readers, every UI module — has line coverage but no measured test _strength_.
`ROADMAP.md` already records this for `layout.ts` under todo 20; the gap is wider than that entry
implies.

**Fix:** widen the scope one module at a time, starting with `src/ontologymodel/`, and record the
score. **Risk:** none to the app; costs CI minutes if it is ever added there.

**Done, and the score is worth having.** A 6m20s run over both pure layers, 1,947 mutants:

| Layer           | Score     | Killed | Survived | Not covered |
| --------------- | --------- | ------ | -------- | ----------- |
| `ontologymodel` | **77.2%** | 1,128  | 239      | 95          |
| `serialization` | **70.1%** | 340    | 124      | 21          |

Which answers the question the finding asked. `ontologymodel` carries a 92% line-coverage
threshold and kills 77.2% of mutants, and 95 of them are not covered at all — so the threshold is
being met by lines that run without anything asserting on what they did. Worst files:
`ontology.ts` 63.2%, `fromTriples.ts` 68.9%, `mutations.ts` 76.2%. Logged as G4.

### F1 — sixteen casts standing in for a lookup

`src/ontologymodel/fromTriples.ts` uses `map.get(key) as string` sixteen times, e.g. line 305:

```ts
const classes = classIris.map((iri) => ({ id: classId.get(iri) as string, … }));
```

Every one is safe **today**: the key always comes from the same list that populated the map a few
lines above (`fromTriples.ts:216-226`). The cast is what makes it safe-looking rather than safe —
if the two ever diverge, the value becomes `undefined` typed as `string` and flows into the model.

**Fix:** a `required(map, key)` helper that throws. **Risk:** low, but it converts a silent wrong
value into a thrown error, which is a behaviour change and needs to be treated as one.

### H1 — the bundle budget has 0.2 kB of headroom

`npm run size` reports `total 204.8 kB (205 kB)`. The gate is one small feature away from failing,
and it is in CI, so the next contributor to trip it will read it as their fault.

**Fix:** decide deliberately — raise it with the reason recorded next to the number, or spend a
pass on what has grown. **Risk:** none either way; the risk is leaving it.

### S1x — "a attribute", in three user-visible strings

`src/canvas/Palette.tsx:65`, `src/canvas/SchemaCanvas.tsx:174`, `src/classeditor/ClassNode.tsx:116`.
The last reads "Drop a attribute here to add an attribute", which is also redundant. Introduced by
`5003a82` "Say relations and attributes in the interface too" — a rename that changed the noun
and left the article. Four more instances sit in comments.

**Fix:** three strings. **Risk:** none, though two e2e test _titles_ carry the same error and can
be left alone or fixed with them.

## 4. Systemic patterns

**Everything is gated except prose.** CI enforces types, lint, formatting, coverage thresholds,
bundle size and behaviour on three engines. No check anywhere asks whether a sentence is still
true. Five of the fourteen findings (E1–E5) are that one gap, and the two most recent were
introduced by merges from the last few days. The codebase has already invented the countermeasure
in one place — `src/relationeditor/RelationDetails.test.tsx` renders the panel and runs the
exporter over the same ontology, asserting that the words on screen and the triples in the file
agree — and it exists precisely because that sentence had been wrong for weeks. That technique is
applied once and could be applied to the README's format claims.

**Renames change the word, not the sentence around it.** `5003a82` produced "a attribute" in seven
places. `b763157` changed the exporter and left two inspector hints claiming the opposite for
weeks. Both are the same habit: a mechanical substitution across many files, with no pass to re-read
the results.

**The boundary rule has no escape hatch, so people copy.** `eslint.config.js` correctly forbids UI
modules importing each other, and correctly offers `projectstore` or `appshell` as the shared
route. Neither fits an eleven-line DOM helper, so it was duplicated (C3). D1 is the same shape:
three modules each need a small piece of persistence, none may reach the module that owns it.

**Dead code survives because it is tested.** C1 and C2 both persisted through several refactors.
The tests around `validateLocalName` are what made it invisible — nothing flags a function whose
only callers are its own tests, and coverage rewards it.

## 5. Top 10 by return on effort

1. **E2** — rewrite the README walkthrough. Highest reader impact, zero risk, one file.
2. **E1** — correct the export-format sections. Same file, and currently self-contradictory.
3. **E3** — regenerate the command table. A contributor's first five minutes.
4. **G1** — fix the two vacuous assertions. Small, and they cover behaviour the writers rely on.
5. **C1** — delete five unused exports. Pure subtraction, proven by the typecheck.
6. **E4** — correct or honour the localStorage claim. One line for the honest version.
7. **S1x** — three strings of user-visible copy.
8. **H1** — settle the bundle budget before it blocks someone.
9. **C3** — one download helper in `designsystem`, one deletion.
10. **G3** — widen mutation scope to `ontologymodel`, and find out what the coverage number is worth.

Left below the line deliberately: **C2** needs a product decision first, **D1** is a refactor
touching persistence, and **F1** converts silence into a throw and is therefore a behaviour change.

## 6. What I could not verify

- **Whether `validateLocalName`'s rules are the ones wanted.** I can prove nothing calls it. I
  cannot tell whether the intent is that bad names are rejected (wire it up) or rewritten (delete
  it). That is C2's blocker.
- **Accessibility beyond the automated checks.** `tests/axe.ts` runs axe in component tests; I did
  not audit keyboard traps, focus order or screen-reader output by hand.
- **The five bundled examples as ontologies.** I checked they build, round-trip and export. Whether
  the modelling in them is _good_ is a domain judgement I did not attempt.
- **Real-browser performance.** `npm run test:perf` passes locally against frame budgets; I did not
  profile, and CI deliberately does not run it.
- **`[UNVERIFIED]` — nothing.** Every finding above was confirmed by reading the code at the cited
  line. Where I suspected a problem and the code disproved it (the `as string` casts being unsafe,
  `ONTOLOGY_ANNOTATION_TERMS` being a superset that would drop annotations on import, the two bare
  `setTimeout`s leaking), it is not listed.
