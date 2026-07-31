# OntoSchema

OntoSchema is a lightweight, browser-based tool for building **schema-level ontologies** — classes,
object properties and datatype properties arranged into taxonomies — on a drag-and-drop canvas, and
exporting them to standard RDF. You drag classes onto a canvas, drop typed attributes onto them, draw
relations between them, build subclass hierarchies in a Protégé-style tree, annotate everything with
RDFS, OWL, Dublin Core, SKOS and PROV-O terms (with language tags), and download the result as Turtle,
RDF/XML (`.rdf` or `.owl`) or JSON-LD — as OWL/RDFS axioms, as SHACL shapes, or both. It runs entirely
in the browser with no backend, and keeps your projects in local storage. Scope is deliberately TBox
only: no individuals, no restrictions, no reasoning.

## The idea that shapes the whole design: a usage

When you draw `Car —offeredBy→ Dealership`, you mean something **local to Car**. RDFS cannot say that.
If `offeredBy` is later drawn from `Van` to `Garage`, the three RDFS options are all wrong or lossy:
repeating `rdfs:domain` means _intersection_ (every Car is also a Van); a union domain and range is
true but **loses the pairing**, licensing `Car offeredBy Garage`; omitting it says nothing.
`rdfs:domain`/`rdfs:range` are global inference rules, not per-class constraints.

So properties here are a **reusable pool with no endpoints**, and a **usage** attaches one to a class:

```ts
DatatypeProperty { id, localName, range, … }   // xsd range is global: price is a decimal everywhere
ObjectProperty   { id, localName, … }          // no domain, no range
PropertyUsage    { id, propertyId, subjectClassId, objectClassId? }
```

A usage maps **1:1 onto a SHACL property shape**, which is per-class and keeps every pairing intact.
Everything else falls out of that one concept:

| Behaviour                                         | Why it works that way                                        |
| ------------------------------------------------- | ------------------------------------------------------------ |
| A datatype property can never float on the canvas | It exists only as a usage on some class                      |
| An object property is invisible until used        | Zero usages means there is no edge to draw                   |
| The same property is reused across classes        | Two usages of one property, pairing preserved                |
| There is no "generic vs scoped" flag              | It is just a usage count: 0, 1, or many                      |
| Exports never contradict themselves               | `rdfs:domain`/`range` only while a property is used **once** |

## Two export layers

Both ride inside the same `.ttl`/`.rdf`/`.owl`/`.jsonld` files — SHACL is a vocabulary, not a
serialization — and each can be switched off in the Export panel.

- **OWL / RDFS axioms**: class and property declarations, subclass and subproperty hierarchies, and
  `rdfs:domain`/`rdfs:range` only where a property is used exactly once. A datatype property's
  `rdfs:range` is always emitted, because it is the same wherever the property is used.
- **SHACL shapes**: one `sh:NodeShape` per class with usages, and one named `sh:PropertyShape` per
  (class, property). Several target classes on one path become a single `sh:or` rather than several
  shapes, because two property shapes on the same path are _conjunctive_ — `Car hasPart Wheel` plus
  `Car hasPart Door` as separate shapes would demand every part be both at once.

Shapes are **named, not blank**. That keeps all three writers free of blank-node and RDF-collection
handling, and makes every shape addressable for annotation and for future `sh:minCount`/`sh:maxCount`.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

### Start from an example

The quickest way in is **Examples** in the header. Each opens as its own project, so anything
you are already working on is left alone.

| Example                 | Classes | What it shows                                                                                                             |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Music library**       | 13      | The gentlest start — everyone knows the domain, so only the modelling is new. `performedBy` covers both studio and stage. |
| **Recipes and cooking** | 13      | The most useful habit there is: when a link needs its own facts (_how much_ flour), it needs its own class.               |
| **Vehicle dealership**  | 15      | A branching taxonomy, and `offeredBy` drawn from three vehicle kinds — watch `rdfs:domain` disappear in the Export tab.   |
| **University**          | 14      | The catalogue-versus-offering distinction, and a course that is a prerequisite of a course.                               |
| **Insurance firm**      | 15      | A `Party` abstraction over people and companies, and one relation whose range differs per policy type.                    |

### The five-minute tour

1. Drag **Class** from the palette onto the canvas twice; double-click each header to name them
   `Car` and `Dealership`.
2. Select `Car`, and in the inspector's **Details** tab add attributes: `make` (string), `model`
   (string), `year` (integer), `engine` (string), `price` (decimal). They appear as typed rows inside
   the class box. (Dragging **Datatype property** from the palette onto a class does the same; onto
   empty canvas it is refused, because an attribute has to belong to a class.)
3. Drag from the dot on `Car`'s right edge to the dot on `Dealership`'s left edge, then pick which
   object property this is — an existing one, or a new one called `offeredBy`.
4. Open the **Annotations** tab and add `skos:prefLabel` twice, with language tags `en` and `nl`.
5. In the **Ontology** tab, set the base IRI and prefix, and add `dcterms:title`.
6. In the **Export** tab, choose whether to include axioms and/or SHACL shapes, then download `.ttl`,
   `.rdf`, `.owl` or `.jsonld`.

To see reuse: open the **Data props** tab in the left panel and drag `price` onto another class. The
list shows it used `2×`, and the export drops its `rdfs:domain` while gaining a second SHACL shape.

### Gestures on the canvas

| Gesture                                             | What it does                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| Drag from a class's right edge to another class     | Draws a relation, then asks which object property it is            |
| **Double-click (or double-tap) a class**            | Brings it into focus: centred, filling about a third of the canvas |
| Double-click a class **header**                     | Renames it in place                                                |
| Drag a datatype property from the pool onto a class | Reuses that property there                                         |
| Delete / Backspace                                  | Removes the selection, unless a dialog is open or you are typing   |

### Scripts

| Command                             | What it does                                                            |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                       | Vite dev server with hot reload                                         |
| `npm run build`                     | Typecheck, then production build to `dist/`                             |
| `npm run preview`                   | Serve the production build                                              |
| `npm run typecheck`                 | `tsc --noEmit`                                                          |
| `npm run lint`                      | ESLint, **including the architectural boundary rules**                  |
| `npm run format` / `format:check`   | Prettier write / check                                                  |
| `npm test`                          | Unit tests (domain model + serializers)                                 |
| `npm run test:integration`          | Integration tests (store → model → all four serializations)             |
| `npm run test:unit-and-integration` | Both vitest projects                                                    |
| `npm run test:e2e`                  | Playwright end-to-end tests (starts its own dev server)                 |
| `npm run verify`                    | Everything CI runs: typecheck, lint, format check, all three test tiers |

First-time Playwright setup: `npm run test:e2e:install`.

---

## Libraries and what each one is for

Runtime dependencies are kept to five. Everything else is a dev tool.

### Runtime

| Library                      | The specific job it does here                                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react` + `react-dom`        | Renders the whole UI.                                                                                                                                                                                                           |
| `@xyflow/react` (React Flow) | The canvas engine behind `canvas/`: pan, zoom, marquee select, node dragging, handle-to-handle connection gestures, and custom node/edge renderers. It replaces roughly two thousand lines of hand-rolled SVG interaction code. |
| `zustand`                    | The app-state container in `projectstore/`. Holds the project list, the active ontology, the current selection, and the undo/redo stack, and notifies React on change.                                                          |
| `n3`                         | Writes Turtle in `serialization/turtle.ts` — prefix folding, literal forms and escaping. Also used as the Turtle **parser** in the test suites.                                                                                 |
| `@dagrejs/dagre`             | Lays out each taxonomy module in `canvas/layout.ts`. Used rather than a simple tree walk because a class may have two superclasses inside one module, making it a DAG that dagre ranks and centres correctly.                   |

**No CSS framework.** Styling is plain CSS Modules (built into Vite, zero dependencies) over a
design-token layer in `designsystem/tokens.css`, with a system font stack so nothing is fetched from
the network. Light and dark themes are both defined.

**RDF/XML and JSON-LD are written by hand** (`serialization/rdfxml.ts`, `serialization/jsonld.ts`),
each about 150 lines over the shared triple list. There is no maintained standalone RDF/XML
serializer in the RDF-JS ecosystem, and `rdf-serialize` or `jsonld` would pull in a large tree to do
expansion, compaction and remote context resolution that this app never needs. Both writers are
validated in the tests by parsing their output with real, independent parsers.

### Development and testing

| Library                                                | The specific job it does here                                                           |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `vite` + `@vitejs/plugin-react`                        | Dev server and production bundler                                                       |
| `typescript`                                           | Types across the whole codebase; `strict` plus `noUncheckedIndexedAccess`               |
| `vitest`                                               | Unit and integration test runner (two projects: `unit` in Node, `integration` in jsdom) |
| `@vitest/coverage-v8`                                  | Coverage for the domain, serialization and store layers                                 |
| `jsdom`                                                | DOM for the integration tier, which exercises `localStorage` persistence                |
| `@playwright/test`                                     | End-to-end tests driving a real Chromium: drag-and-drop, edge drawing, file downloads   |
| `rdfxml-streaming-parser`                              | Parses generated RDF/XML back in tests — an independent check on our writer             |
| `jsonld-streaming-parser`                              | Parses generated JSON-LD back in tests — likewise                                       |
| `eslint`, `@eslint/js`, `typescript-eslint`, `globals` | Linting, and the `no-restricted-imports` rules that enforce the module boundaries       |
| `eslint-plugin-react-hooks`                            | Catches hook misuse, including setState-in-effect                                       |
| `prettier`                                             | Formatting                                                                              |
| `husky` + `lint-staged`                                | Pre-commit hook: format, lint, and the unit tests affected by staged files              |
| `@types/*`                                             | Type definitions for node, react, react-dom and n3                                      |

---

## Architecture

The organising principle is a **pure domain model as the single source of truth**, with everything
else depending inward on it. Directories are named for the domain function they perform.

```
src/
  annotationvocabulary/   Pure data. The RDFS/OWL/DCTERMS/SKOS/PROV term registry, the
                          xsd datatype list, namespace table and language-tag helpers.

  ontologymodel/          Pure, framework-agnostic domain model — the single source of truth.
                            types.ts       Ontology, classes, properties, usages, annotations
                            identifier.ts  IRI construction, local-name validation/sanitising
                            mutations.ts   Immutable (ontology, args) => ontology operations
                            taxonomy.ts    Hierarchy forests, cycle prevention, module grouping,
                                           and the flat datatype-property pool
                            triples.ts     The model → abstract Triple[] projection: axioms
                                           and SHACL shapes
                            ontology.ts    Construction, lookup, and the derivation indexes

  serialization/          Pure. Renders Triple[] as Turtle, RDF/XML and JSON-LD, plus the
                          download descriptors. Depends only on the domain model.

  examplelibrary/         Pure. The ready-made schemas, written as declarative specs and
                          built through the ordinary mutation API — so an example can only
                          ever be a state the editor could have produced by hand.

  projectstore/           App state: owns *when* the ontology changes, while ontologymodel
                          owns *how*.
                            history.ts             PURE. Undo stack and its transitions,
                                                   including keystroke coalescing.
                            workspace.ts           PURE. Which projects exist and which is
                                                   open, with the always-one invariant.
                            editing.ts             The single path by which the ontology
                                                   changes: record history, stamp, persist.
                            ontologyactions.ts     Editing the schema.
                            interactionactions.ts  Selection, view, pending connections.
                            workspaceactions.ts    Projects, undo/redo.
                            persistence.ts         localStorage and document revival.
                            dragpayload.ts         The drag contract shared by the palette,
                                                   the property pool and the canvas.
                            store.ts               Composition only.

  designsystem/           Leaf UI primitives and design tokens. Imports nothing from src/.

  canvas/                 React Flow surfaces. Derives the graph from the ontology, handles
                          palette drops and connection gestures, and lays out the taxonomy.
                          Only classes are nodes; properties appear as rows and edges.
  classeditor/            The class node shape with its attribute rows, plus the class and
                          attribute inspector sections.
  relationeditor/         Relation edges, subclass edges, the connection picker, and the
                          object-property inspector section.
  taxonomytree/           Class and object-property hierarchies, plus the flat datatype
                          property pool you drag onto a class to reuse it.
  annotationpanel/        Vocabulary-driven annotation editing with language tags.
  ontologymetadata/       Base IRI and prefix.
  exportpanel/            Format picker, live preview, and download plumbing.
  projectswitcher/        New / switch / rename / delete / save / open project.

  appshell/               The single composition point: layout, keyboard shortcuts, the
                          inspector, and the binding of canvas node types to their renderers.
```

### Dependency rules

These are **enforced by ESLint**, not just documented. `npm run lint` fails on a violation.

| Layer                   | May import                                                                                    | May **not** import                                   |
| ----------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `annotationvocabulary/` | nothing from `src/`                                                                           | everything else                                      |
| `ontologymodel/`        | `annotationvocabulary/`                                                                       | React, React Flow, zustand, the store, any UI module |
| `serialization/`        | `ontologymodel/`, `annotationvocabulary/`                                                     | React, the store, any UI module                      |
| `examplelibrary/`       | `ontologymodel/`, `annotationvocabulary/`                                                     | React, the store, any UI module                      |
| `designsystem/`         | nothing from `src/`                                                                           | every other `src/` module                            |
| `projectstore/`         | `ontologymodel/`, `annotationvocabulary/`                                                     | any UI module                                        |
| UI modules              | `ontologymodel/`, `projectstore/`, `designsystem/`, `annotationvocabulary/`, `serialization/` | **each other**, and `appshell/`                      |
| `appshell/`             | anything                                                                                      | —                                                    |

To confirm the rules still bite, add `import { useProjectStore } from '../projectstore'` to any file
in `src/serialization/` and run `npm run lint`.

Two consequences worth calling out:

- **The serialization layer never sees UI code.** All three writers consume the same `Triple[]`
  produced by `ontologymodel/triples.ts`, which is why Turtle, RDF/XML and JSON-LD are semantically
  identical by construction rather than by careful maintenance.
- **UI modules do not import one another.** `canvas/` refers to node types by string name; the
  components that render them are injected by `appshell/graphRenderers.ts`. Drawing an edge does not
  reach into `relationeditor/` either — the canvas records a _pending connection_ in the store, and
  the picker that resolves it is mounted by `appshell/`. Anything two UI modules must agree on (the
  drag payload, the pending connection) lives in `projectstore/`, the explicit shared layer.

### The two canvas views

- **Schema** — free-form. Class boxes carry their datatype properties as typed rows. Scoped object
  properties are coloured, arrow-headed edges with a clickable label; the direction you draw sets
  domain and range. Generic object properties are standalone pills with no domain or range.
- **Taxonomy** — derived and auto-laid-out. Each root class becomes its own labelled bounding box
  containing a top-down dagre tree, so unrelated branches never cross and large ontologies stay
  legible. Subclass links are grey orthogonal lines ending in a hollow UML generalization triangle —
  deliberately distinct from relations, and the same shape a Mermaid or PlantUML class diagram uses.

A note on state: the ontology is the source of truth for _what exists_; React Flow owns the transient
interaction state (what is selected, where a node is mid-drag). The two are reconciled in
`SchemaCanvas`, not merged. Folding selection into the derived graph rebuilds every node object on
each click, which tears down node DOM in the middle of multi-click gestures.

---

## Testing

Three tiers, all runnable locally and all run in CI.

**Unit** (`src/**/*.test.ts`, Node) — local-name sanitising and rejection of IRI-breaking characters;
taxonomy roots, descendants and **cycle prevention**; cascade delete; the triple projection; and each
of the three serializers.

**Integration** (`tests/integration/`, jsdom) — drives the real store through a realistic editing
session, projects to triples, serializes all four outputs, **parses each back with a real parser**,
and asserts the four graphs are identical. Also covers undo/redo, multi-project isolation, project
file round-trips, and recovery from a corrupt stored workspace.

**End-to-end** (`tests/e2e/`, Playwright + Chromium) — the full Car/Dealership workflow performed
through the real UI: HTML5 drag-and-drop from the palette, double-click rename, handle-to-handle edge
drawing, annotation in two languages, a real file download, and assertions on the downloaded bytes
parsed with `n3`. Plus taxonomy layout, cascading delete, rename propagation, invalid IRI characters,
empty-ontology export, multi-project switching, and survival across a page reload.

**Mocking policy:** the domain model, the serializers and the browser all run for real. Nothing that
can execute is stubbed.

### About the rdflib acceptance check

The brief asks that exports "parse cleanly in rdflib". CI enforces something stronger, in JavaScript:
every export is parsed with an independent real parser (`n3`, `rdfxml-streaming-parser`,
`jsonld-streaming-parser`) and the four resulting graphs are compared for equality — a parse check
plus a cross-format agreement check.

For an independent second opinion from a different implementation stack, `scripts/verify_exports.py`
does the same thing with Python rdflib:

```bash
pip install rdflib
python scripts/verify_exports.py ontology.ttl ontology.rdf ontology.owl ontology.jsonld
```

It is not part of CI, because it needs a Python toolchain the rest of the project does not.

---

## Continuous integration and hooks

- **CI** — `.github/workflows/ci.yml` runs typecheck, lint, format check, build, unit, integration
  and Playwright on every push to `main` and every pull request, with the Playwright browser cached
  and the HTML report uploaded on failure.
- **Pre-commit** — `.husky/pre-commit` runs `lint-staged` (Prettier then `eslint --fix` on staged
  files) followed by `vitest related` for the unit tests affected by those files. Integration and
  e2e are left to CI so committing stays quick.

---

## Deliberately out of scope

Individuals and ABox data; OWL restrictions, unions, intersections, cardinalities and property
chains; reasoning; importing existing ontologies; server-side persistence; authentication;
collaboration. The architecture leaves room for these — the domain model and serialization layer are
pure and UI-free, and `projectstore/persistence.ts` is the only file that knows storage exists — but
none of them are implemented.
