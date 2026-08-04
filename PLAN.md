# OntoSchema — remediation pass: UI correctness, component tests, hygiene

## Context

The MVP works and its domain/serialization layers are well covered (162 unit+integration tests,
17 e2e, rdflib-verified exports). But a review found the UI layer has **2,770 lines of TSX and zero
component tests**, and the user then hit a focus bug by hand that no existing test could have caught.

That bug is not isolated — it is one of a _class_ of defects that only component-level tests find.
Two have been confirmed by reading the code; more are suspected. This pass fixes them, builds the
missing test tier that would have caught them, and closes the process gaps from the review.

## Confirmed bug 1 — focus stolen on first keystroke (the reported one)

`Modal` in [Primitives.tsx:290-299](src/designsystem/Primitives.tsx) runs one effect keyed on
`[open, onClose]` that both registers the Escape listener **and** moves focus:

```ts
dialogRef.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
```

`ConnectionPicker` passes `onClose={close}`, an arrow function rebuilt on every render. So typing one
character → `setNewName` → re-render → new `close` identity → effect re-runs → focus jumps to the
**first focusable in DOM order**, which is the "Object property to use" `<select>`, not the name box.

`ProjectSwitcher`'s two modals have the same unstable `onClose`; they only _look_ fine because their
first focusable happens to be the field you are already in.

**Root cause: an effect with a side effect, keyed on an unstable callback identity.**

## Confirmed bug 2 — typing destroys undo history

`edit()` in [store.ts:147-149](src/projectstore/store.ts) captures an undo snapshot by default;
only `moveClass` opts out with `capture: false`. Meanwhile `NameInput` commits **on every keystroke**
([Primitives.tsx:153](src/designsystem/Primitives.tsx)), and so do the annotation value fields and the
base-IRI/prefix fields.

So renaming `Car` → `Automobile` pushes 10 undo entries, and typing a 60-character `skos:definition`
pushes 60. With `HISTORY_LIMIT = 50`, **one sentence silently wipes every real undo step you had.**

## Suspected, to be confirmed or cleared by the new tests

- `Modal` has no focus trap, does not restore focus on close, and leaves the background reachable to
  screen readers (no `inert`/`aria-hidden`).
- Global Backspace in [App.tsx:152+](src/appshell/App.tsx) guards only `INPUT/TEXTAREA/SELECT`. Focus a
  hierarchy tree row (a `div` with `tabIndex=0`) and press Backspace — it deletes the selected class.
- Drag-only interactions with no keyboard path: tree re-parenting, and dragging a property from the
  pool onto a class.
- `--text-tertiary` `#8a929f` on white is **≈3.1:1**, below the WCAG AA 4.5:1 floor, and is used for
  hints/counts at 11px.
- `AttributeDetails`' "add to a class…" `<Select value="">` is a write-only control — the same smell
  called out in the review and then reintroduced.
- `ProjectNameField` writes to `localStorage` on every keystroke.

## Ordering, and why

The order is driven by three rules:

1. **Build the harness first.** Every fix below needs a component test to prove it; writing fixes
   first means going back over the same files.
2. **Fix the shared lowest layer before its consumers.** `Modal` and the store's history are used by
   every panel. Fixing them first means panel tests are written once, against final behaviour, rather
   than written and then rewritten.
3. **Zero-churn process work last.** CI, licence and coverage config touch no application code, so
   they cannot conflict and are cheapest at the end.

Each stage is **one commit** — this is also how the "single commit, no history" finding gets fixed
going forward; existing history cannot be retroactively split.

### Stage 0 — component test harness (prerequisite)

Re-add `@testing-library/react` + `@testing-library/user-event` (they now earn their place), add a
third vitest project `component` (jsdom, `src/**/*.test.tsx`) in [vite.config.ts](vite.config.ts), and
one smoke test. Add `test:component` to the scripts and to `verify`.

### Stage 1 — the focus/effect bug class

Rewrite `Modal`: split the Escape listener from focus management; hold `onClose` in a ref so listener
identity stops mattering; move focus **once per open**, preferring an element the caller marked
`autoFocus`; add a Tab focus trap; restore focus to the previously focused element on close; mark the
background `aria-hidden`. Then audit every `useEffect` in `src/` for the same unstable-dependency
pattern.

Regression tests: typing in `ConnectionPicker` keeps the caret in the name field; Tab cycles inside
the dialog; Escape closes and returns focus.

### Stage 2 — undo coalescing

Give `edit()` a third history mode alongside `capture: true|false`: **coalesce**, which merges into the
previous entry when the same logical target is edited again within a short window. Route renames,
annotation values and the ontology header through it.

Recommended over the alternative (commit only on blur/Enter) because it keeps the canvas updating live
as you type, which is the behaviour the app was deliberately built for.

Tests: an integration test asserting that renaming a class letter-by-letter yields **one** undo entry,
and that one undo restores the original name.

### Stage 3 — component tests for the panels with real logic

`ConnectionPicker`, `AnnotationEditor`, `HierarchyTree` (all three tabs), `ClassDetails`,
`AttributeDetails`, `RelationDetails`, `ExportPanel`. Behaviour-level, driving the real store — no
mocking of the model. Fix whatever they surface, including the suspected items above.

### Stage 4 — accessibility

Raise `--text-tertiary` to meet 4.5:1 in both themes and re-check every token pair; add keyboard paths
for the drag-only interactions; add an error boundary in `appshell/`; wire `axe-core` assertions into
the component tests.

### Stage 5 — process hygiene (no application code)

Point Playwright's `webServer` at `vite preview` on the built output so **CI tests what actually
ships**; add coverage thresholds and run coverage in CI; add `LICENSE`, `CONTRIBUTING.md` and
Dependabot.

## Explicitly out of scope for this pass

The ~430-line store god object (review item #2), responsive layout below ~1100px, bundle-size budget
and code splitting, and multi-browser e2e. All are real; none block correctness, and the store split
is much safer once Stage 3 has locked its behaviour down with tests.

## Verification

- `npm run verify` green, now including the `component` project.
- The reported bug reproduced as a failing test first, then passing.
- Undo test: rename letter-by-letter → one undo entry.
- `npm run test:e2e` running against the **production build**.
- Manual pass in the browser: create a property, type into the picker, confirm the caret stays put.
- Re-run the five ESLint boundary probes and the rdflib export check to confirm nothing regressed.
