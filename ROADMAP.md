# OntoSchema — roadmap

Where the project is going. One line per item: what it is, why it is worth doing, and roughly
how big it is (**S** a sitting, **M** a day or two, **L** a project in its own right).

Anything already built is described in the [README](README.md); this file is only about what is
not. Items are grouped by theme, not by order — the running order lives in **Next up** below and
is the only part that claims to be a commitment.

---

## What this tool is for

this app is a linked data engineering workflow for building semantic layers for applications in a business context such as: legal compliance checking, RAGs for explainable chatbot responses, building validation, interoperability and provenance infrastructure for heterogeneous data in finance, insurance and pension firms. Often the common pattern is we need to build a lightweight terminology that we use to convert data from Excel, CSV, SQL etc. into RDF triples put them in graphdb with SHACL constraints, and we want to do SHACL validation to verify which data is acceptable or not. Or we want to harmonise data across departments and formats. Or we want to model exclusion and inclusion criteria for insurance coverage rules buried in free text PDF documents in some sort of way that using linked or semantic web technologies. I noticed a gap that ontology editors are either proprietary or very dated, or overly feature-packed with steep learning curve, I wanted a lightweight schema editor to build RDF/OWL vocabularies and schemas which can be used in semantic data engineering workflows.

---

## Next up

**Nothing new until the core is solid.** The current phase is hardening what is already here —
schema editing that is fast, stable and predictable at real sizes — and the bar for that is
written down in [Hardening the core](#hardening-the-core). Feature work resumes after it.

1. **Rename an attribute in place on the canvas** — the gesture is already taken and currently
   does the wrong thing
2. Hardening the core, to the definition of done below
3. Multiple superclasses through the UI — the one modelling gap that is a defect, not an addition
4. Mermaid export

The reasoning is in [Proposed running order](#proposed-running-order) at the foot of the file.

---

## Hardening the core

The tool should do one thing completely rather than several things adequately. Before any new
surface area, schema editing itself has to be robust, stable and responsive at the sizes real
work reaches. This section is the current phase.

**Definition of done** — the phase ends when all of these hold, each proved by a test that runs
in `npm run verify`:

| Bar                                                                                        | How it is proved                                            |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| A 200-class schema opens, pans and zooms without a dropped frame                           | `scale.spec.ts` — **met**: a steady 16.7ms frame            |
| No edit blocks the main thread for more than one frame                                     | `scale.spec.ts` — **met**: a typical run misses no frame    |
| A long random editing session leaves the model self-consistent, and undo returns it intact | seeded fuzz over the store, extending the existing harness  |
| Every gesture has a keyboard equivalent                                                    | component tests, plus axe on each panel                     |
| A crash loses no work                                                                      | the error boundary restores the workspace, not just reloads |

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Size |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| ~~**Measure the canvas and store at scale**~~ — _done, `tests/e2e/scale.spec.ts`._ At 200 classes: opens in 405ms; pan and zoom hold a steady 16.7ms frame, because the viewport moves a CSS transform rather than re-rendering; **one keystroke loses 67ms of main thread and writes 194kB of JSON**. The canvas is not the problem. The edit path is.                                                                                                                                                                                                                   | —    |
| ~~**Stop writing the whole workspace on every keystroke**~~ — _done, `savequeue.ts`._ Was 7 writes and 1.4MB for a 7-character rename; now one write once typing stops, bounded so work is never unsaved for long, and flushed when the page is hidden.                                                                                                                                                                                                                                                                                                                   | —    |
| **Build the ontology index once per change, not three times** — `schemaNodes`, `schemaEdges` and the taxonomy each call `indexOntology` independently, so every edit rebuilds it three times over. Worth doing after the storage fix, and only if the stall survives it — the measurement will say.                                                                                                                                                                                                                                                                       | S    |
| **Soak the editing session** — the seeded fuzz harness covers the pure model. Point it at the store instead: long random sessions of create, rename, connect, delete, undo, redo, asserting the invariants hold and that undoing everything returns the starting ontology.                                                                                                                                                                                                                                                                                                | M    |
| **Keyboard equivalents for the mouse-only gestures** — re-parenting in the hierarchy tree and dropping a datatype property onto a class are both drag-only. A tool used all day needs both, and a gesture with no keyboard path is also a gesture with no cheap test.                                                                                                                                                                                                                                                                                                     | M    |
| **Find the WebKit flake in the end-to-end suite** — run the whole suite in parallel and roughly one in three goes fails on WebKit, on a different spec each time: `carDealership`, `examples`, `editingWorkflows`, `stressWorkflows`. Run serially it is clean, and CI runs serially, so nothing is blocked today — which is exactly why it will rot if left. Every instance so far has been an actionability timeout waiting for an element to be _stable_, so the first question is what is still moving. Chase it as one piece of work rather than one spec at a time. | M    |
| **Recover rather than reload after a crash** — `ErrorBoundary` offers `window.location.reload()`. That is honest but lossy; the workspace is in `localStorage` and could be restored to the last good state instead.                                                                                                                                                                                                                                                                                                                                                      | S    |

## Editing on the canvas

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Size |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Focus an empty class at the right size** — double-clicking a class that has no attributes yet zooms to about 46% of the canvas rather than the 30–40% the gesture promises, and sits a little high. The node is measured at roughly 100px, then its placeholder text reflows and it settles at 131px, so both the zoom and the centre are computed from a node smaller than the one that ends up on screen. Classes carrying attributes measure once and are unaffected. Either wait for the measurement to stop changing before framing, or stop the placeholder reflowing.                                                         | S    |
| **Rename an attribute in place** — double-click a datatype property row inside a class node and edit its name there, the way a class header already works. Today the row is a button that selects the property and sends you to the inspector, and a double-click on it **bubbles to the node and zooms the canvas** — so the gesture is not merely missing, it is taken and doing the wrong thing. Needs `stopPropagation` on the row, the same invalid-name treatment the class header uses, and a decision about shared properties: a datatype property may sit on several classes, and renaming it from one renames it everywhere. | S    |

## Modelling power

Everything here stays inside the TBox, which is the line the project has drawn from the start.

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Size |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Multiple superclasses in hierarchy and canvas** — _verified: the model allows it, the UI does not._ `OntologyClass.superClassIds` is a list, `addSubClassOf` appends, and the class node already renders `⊂ Vehicle, Asset`. But every UI path goes through `setSuperClass`, which **replaces** — both the inspector's single `<select>` and the hierarchy tree's drag-to-reparent. Needs a multi-value control in the inspector and an add-a-parent gesture in the tree distinct from move-a-parent. | M    |

## Export and interop

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Size |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Mermaid diagram export** — asked for in the original brief and still not built. The subclass edge already draws the hollow triangle Mermaid uses, so the visual vocabulary matches. I love the neatness of the taxonomy diagram tab but no non-subclass edges are there which could be the reason they look so neat. _Split out from PlantUML and sized down: it is a text serializer over the model the four existing writers already share, and adds no dependency._                                                                                                                                                                                                                                                                                                               | S    |
| **PlantUML diagram export** — the same walk over the model, a second grammar. Worth doing only if Mermaid proves the demand.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | S    |
| **Specify owl:imports for external vocabs from URL** — OntoSchema does not need to load the entire vocabulary into the canvas. Just maintain a cache or memory or localStorage where you load the external ontologies and in the interface all I want is a way to reuse terms that I WANT from those vocabs. I want terms that I don't use to be completely hidden and invisible. But then I would need a way to find or discover terms I need. Perhaps dropdown or search box with BM25 or something like that. Be clever and elegant with this in the interface and use your ontology engineering expertise to judge the best method. _Design settled: no proxy, and no fetch on the critical path — see [Resolving external vocabularies](#resolving-external-vocabularies) below._ | L    |
| ~~**SHACL conversion and export**~~ — _already built._ Every usage becomes a named `sh:PropertyShape`, several targets on one path become a single `sh:or`, and the Export panel can switch the OWL/RDFS axioms off. Unticking axioms and downloading `.ttl` already gives a shapes-only Turtle file. See [Two export layers](README.md#two-export-layers). What is missing is not the export but the **vocabulary of constraints** — see the note below.                                                                                                                                                                                                                                                                                                                              | —    |

> **Decided: deferred, not rejected.** A richer SHACL constraint vocabulary — `sh:minCount`,
> `sh:maxCount`, `sh:pattern`, `sh:in`, datatype facets — is real and would be useful, but adding
> it now would dilute focus. This tool should be the best and most efficient **schema editor**
> first: polished, robust, stable, responsive, properly tested. Constraint authoring is a second
> job, and doing both adequately is worse than doing one completely.
>
> Revisit only once [Hardening the core](#hardening-the-core) is done, and then as an explicit
> choice between a **SHACL submodule** inside OntoSchema and a **separate tool** that consumes the
> exported vocabulary. The second is likelier to be right: the two have different users and
> different cadences, and the export format is already the seam between them.
>
> Nothing is blocked in the meantime. Named shapes stay addressable, so whichever way it goes, the
> constraints attach to shapes that already exist.

### Resolving external vocabularies

**Decided: vocabularies are bundled, and refreshed at build time — the browser never fetches one.**
Uploading or pasting a vocabulary file is ruled out.

The premise that makes this safe is that **`owl:imports` never depends on a fetch**. The export
needs one triple containing an IRI the user typed, and that works whether or not anything was
resolved. Everything below is only about the _convenience_ of browsing a vocabulary's terms to
pick the ones worth reusing.

#### What was measured, not assumed

Probed 2026-08-01 with a cross-origin `Origin` header:

| Vocabulary              | Host                  | Cross-origin?                           | Served as                             |
| ----------------------- | --------------------- | --------------------------------------- | ------------------------------------- |
| SKOS, PROV-O, ORG, DCAT | `w3.org`              | yes, Origin reflected                   | RDF/XML for SKOS, Turtle for the rest |
| `dcterms`               | `purl.org`            | yes, `*`                                | HTML by default                       |
| FOAF                    | `xmlns.com`           | yes, `*`                                | HTML by default                       |
| schema.org              | `schema.org`          | yes, `*`                                | Turtle                                |
| FIBO                    | `spec.edmcouncil.org` | yes, `*`                                | Turtle                                |
| OMG Commons             | `omg.org`             | **no header**                           | RDF/XML                               |
| LOV term search API     | `lov.linkeddata.es`   | yes, `*` — but **502 during the probe** | —                                     |

So the common vocabularies mostly _are_ reachable from a browser. But note what that means:
**nothing here circumvents CORS.** Those hosts simply allow it. Where a host does not — OMG above,
or any vocabulary on a company server — no amount of client-side cleverness helps, and that is
precisely the case the tool cannot afford to be brittle about.

#### Which vocabularies ship

`dcterms`, `dcat`, `prov-o`, `foaf`, `org`, `vCard`, `schema.org`. FIBO is a candidate for later.

Deliberately **not SKOS**: it belongs to a different job. SKOS models how existing terms are
organised and aligned — a meta level of labels and concept schemes — whereas an OWL/RDFS schema
models the domain itself, the things the instances are. Reusing SKOS _terms_ in a domain schema
invites exactly that confusion.

> **The SKOS annotation properties stay, and this is not an inconsistency.** The exclusion above is
> about SKOS as a _modelling_ vocabulary: `skos:Concept`, `skos:broader`, `skos:inScheme`. None of
> those appear anywhere in the codebase and none ever should — classes are `owl:Class` and
> hierarchy is `rdfs:subClassOf`.
>
> What the annotation panel offers is the eight SKOS _documentation_ properties: `prefLabel`,
> `altLabel`, `hiddenLabel`, `definition`, `scopeNote`, `note`, `example`, `editorialNote`. Those
> are annotation properties, which in OWL 2 are semantics-free by construction — a reasoner ignores
> them, so `skos:definition` on an `owl:Class` makes no claim about that class and certainly does
> not make it a concept. SKOS declares no `rdfs:domain` on them precisely so they can be used this
> way, and FIBO annotates its own OWL classes with `skos:definition` throughout.
>
> They also earn their place here. `rdfs:comment` alone would have to carry definition, scope note,
> example and editorial note at once, and a scope note saying when a class does and does not apply
> is exactly what an inclusion or exclusion criterion needs. `altLabel` and `hiddenLabel` are where
> lexical variants live, which is what lets a retrieval layer match a user's phrasing to a class.

The set as a whole is chosen to cover what a business domain schema actually reaches for: people
and organisations (`foaf`, `org`, `vCard`), general-purpose types (`schema.org`), dataset and
catalogue description (`dcat`, `dcterms`), and provenance (`prov-o`).

#### The design

A repo script, `npm run vocab:refresh`, fetches each vocabulary **in Node, where CORS does not
exist**, parses it, and writes a small normalised index: IRI, label, comment, and whether the term
is a class or a property. The app ships those indexes as lazy chunks and reads nothing else. A
scheduled CI job re-runs the script and opens a pull request when a vocabulary has changed.

This answers the staleness objection head on: updates ripple automatically, they just arrive
through a release rather than at runtime, and they arrive reviewed. In practice the drift is small
anyway — PROV-O has been unchanged since 2013 — but the job means nobody has to rely on that.

Three further things fall out of moving the fetch to build time:

- **Syntax stops mattering.** Vocabularies are published in whatever their authors chose, and at
  build time that is a parser choice rather than a browser problem. `n3`'s `Parser` is agreed for
  Turtle and N-Triples, and it is already a runtime dependency for the writer, so it costs nothing;
  anything published only as RDF/XML gets a dev-only parser in the refresh script, never in the
  shipped bundle.
- **Size stops mattering.** The index is a fraction of the source — schema.org is a couple of
  megabytes of Turtle and perhaps a couple of hundred kilobytes of index — so the bundle budget
  survives and `schema.org` needs no special case.
- **The app gains no runtime dependency at all.** No network code, no cache, no failure modes.

An optional refresh-at-runtime button could be layered on later for the hosts that allow it, but
it would be a convenience over a working offline path, never the path itself.

#### The gap this leaves, and it is a real one

With file upload ruled out, a vocabulary that is neither bundled nor CORS-permitted — an internal
one on a company server, anything on `omg.org` — has **no term browser**. The user can still type
its IRI and it exports correctly; they just get no discovery for it. That is a coherent product
line ("we help you reuse the vocabularies we know about, and you can import anything"), but it is
worth naming rather than discovering later. Widening the bundled set is the lever, and adding to it
is a one-line change to the refresh script.

#### Correction

An earlier note here claimed that asking for `text/turtle` triggers a CORS preflight. It does not:
`Accept` is a safelisted request header, so a `GET` carrying it is a simple request. The claim was
wrong and is not a reason to avoid content negotiation.

**Keeping the desktop option cheap.** The codebase already has the right pattern:
`projectstore/persistence.ts` is the only file that knows storage exists. If runtime fetching is
ever added, giving it one adapter module of its own means a desktop shell later is a swap of two
small modules, not a rewrite. See [Staying a web app](#staying-a-web-app) under the non-goals.

## Canvas and readability

| Item                                                                                                                                                                                                                                                                                                                                              | Size |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Edge label collision avoidance** — a relation's label can park on top of an unrelated class. Straight edges between aligned classes pass over whatever is between them; the label makes it obvious.                                                                                                                                             | M    |
| **Tidy-up / auto-layout for the schema view** — the taxonomy view lays itself out with dagre; the schema view never does. A button, not automatic.                                                                                                                                                                                                | M    |
| **Find and jump to an entity** — a search box or `Ctrl`+`K`. Already wanted at fifteen classes, which the examples reach.                                                                                                                                                                                                                         | S    |
| **Subschema filter** — narrow the canvas to a chosen set of classes and relations, or to one class and what it touches, and hide the rest. The answer to a spaghetti diagram that no amount of layout fixes, and the only thing that actually scales. _Was listed twice: also appeared under Editing workflow as "filter schema for subschemas"._ | M    |
| **Grouping in the schema view** — bounding boxes per taxonomy module, as the taxonomy view already does.                                                                                                                                                                                                                                          | M    |
| **Stepped / orthogonal edges as an option** — now that each edge picks a side, right-angled routing is a small step and reads better for dense schemas.                                                                                                                                                                                           | S    |

## Editing workflow

| Item                                                                                                                                                                                                                                                                                                                                     | Size |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Multi-select** — box-select several classes, then move or delete them together.                                                                                                                                                                                                                                                        | M    |
| **Duplicate a class** — with its attributes, as a starting point for a sibling.                                                                                                                                                                                                                                                          | S    |
| **Schema diffing (given two loaded schemas) to compute and generate changelog entries using the Keep a Changelog standard** — governance for a vocabulary that other teams depend on. Sized up from S: it needs two ontologies loaded at once, a structural diff that survives renames, and a mapping from diff to changelog categories. | L    |

## Housekeeping

| Item                                                                                                                                                                                                                                                                   | Size |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Export and import a whole workspace** — save/open works per project; there is no way to move all of them between machines in one file.                                                                                                                               | S    |
| **Undo across a project switch** — history is per session, and switching projects loses it silently. Sized up from S: making it per-project means re-keying `history.ts` and deciding what a deleted project's history does.                                           | M    |
| **Cross-tab safety** — two tabs on the same workspace both write `localStorage` and the last one wins. Worth splitting: _detecting_ it with a `storage` listener and warning is **S**; merging the two versions is **L**. Do the first, and probably never the second. | S    |

---

## Deliberately not doing

These are stated as non-goals in the [README](README.md#deliberately-out-of-scope) and remain so.
The architecture leaves room for each — the domain model and serialization layer are pure and
UI-free, and `projectstore/persistence.ts` is the only file that knows storage exists.

- Individuals and ABox data
- Any advanced OWL logical axioms (this is a SCHEMA tool not a full OWL ontology editor)
- OWL restrictions, unions, intersections, property chains
- Reasoning of any kind
- Server-side persistence, authentication, real-time collaboration

### Staying a web app

Packaging as a desktop app is deferred, and specifically **not** something CORS should decide —
that is solvable in the browser without a proxy, as above, and is the weakest possible reason to
change how the tool is delivered.

What would genuinely justify a desktop build is filesystem and local-network access: `Ctrl`+`S`
straight to `schema.ttl` rather than a downloads-folder dance, no `localStorage` quota, and
reaching a GraphDB on the local network. None of those are on this roadmap, and the first is
partly available already — the File System Access API gives a persistent file handle in Chromium
browsers, with the existing download path as the fallback elsewhere.

Against it: the touch and mobile work becomes dead weight; code signing, auto-update and a
cross-platform build matrix are real ongoing costs for a deliberately lightweight tool; and "open
a URL, nothing to install" is a genuine advantage for something whose stated gap is that the
alternatives are heavyweight. It is also a large new surface area during a phase that has just
declared none.

If it is ever done, **Tauri over Electron** — a system WebView and a small Rust host, single-digit
megabytes rather than a hundred, and HTTP issued from the host process, where CORS does not apply
at all. Either way it is a shell over the same built assets, which is why the adapter seam above
is worth having.

---

## Proposed running order

The tool is not trying to be a Swiss army knife. It should do schema editing better than anything
else and stop there, so the ranking question is no longer "does this add capability?" but **"does
this make the one job more solid, or does it widen the job?"** Solidity first, then the smallest
additions that finish what is already started.

1. **Hardening the core** (S items, one M) — the current phase, with a written bar to end it.
   Everything in it is small and independent, which makes it good work to do first: no design
   pass, no new dependency, and each piece is one commit. Measuring came first and paid twice
   over: it retired the canvas performance worry outright, and then retired the index rebuild
   too — 0.077ms of a 40ms problem — sending the effort to the thing that was actually
   costing, which was handing React Flow 200 new nodes and 199 new edges per keystroke.
   Speed is now done; what remains in the phase is the soak test, the keyboard paths and
   crash recovery.
2. **Multiple superclasses through the UI** (M) — the one modelling item that is a defect rather
   than an addition. Business vocabularies are full of classes that are two things at once — a
   `LeaseAgreement` is a `Contract` and a `FinancialInstrument` — and the interface silently
   replaces one parent with the other. The model, the exporters and the class node already handle
   several parents, so this widens nothing; it finishes something.
3. **Mermaid export** (S) — the outstanding item from the original brief, a text serializer over
   the model the four existing writers already share, and no new dependency. Small enough to fit
   in the hardening phase if it stalls. The observation in the table is worth acting on: the
   taxonomy tab reads cleanly because it draws one edge kind, and a Mermaid class diagram has the
   same property.
4. **Subschema filter** (M) — the first thing that bites when a schema passes about thirty
   classes, which the insurance and finance cases will. Cheaper and more effective than any amount
   of auto-layout, because hiding is the only thing that actually scales. Do this before the
   layout and grouping items; it may make them unnecessary.
5. **Canvas readability and housekeeping** (mostly S) — edge label collision, find-and-jump,
   orthogonal edges, duplicate a class, workspace export, cross-tab detection. Individually small
   and independently shippable. Good filler, and good work whenever something larger is waiting on
   a decision.
6. **`owl:imports` and selective term reuse** (L) — moved down from second. It is the most
   valuable item on the list for interoperability, and also the largest new dependency surface in
   a project whose stated virtue is having almost none: network fetching, a cache, a parser for
   foreign vocabularies, and a search index. The CORS problem noted in the table needs a design
   pass before any code. Worth doing properly later rather than half-way now.
7. **Schema diffing and changelog** (L) — governance, and it only pays once vocabularies are
   versioned and in use, which is downstream of everything above. Its own design pass.

Deferred deliberately: the SHACL constraint vocabulary, and with it the question of whether
constraint authoring belongs in this tool at all. See the note under
[Export and interop](#export-and-interop).

### Sizes revised in this pass

| Item                       | Was | Now | Why                                                             |
| -------------------------- | --- | --- | --------------------------------------------------------------- |
| Multiple superclasses      | S   | M   | Verified: a UI gap, not a check. Two controls, not one.         |
| Mermaid / PlantUML export  | M   | S+S | Split. Each is a text writer over an existing model walk.       |
| Subschema filter           | S   | M   | Was also listed twice, once per section. Now one item.          |
| Schema diffing             | S   | L   | Two ontologies loaded, a rename-tolerant diff, a category map.  |
| Undo across project switch | S   | M   | Re-keys `history.ts` and needs a rule for deleted projects.     |
| Cross-tab safety           | M   | S   | Detect and warn is small. Merging is large, and probably never. |

## Features todo

Kody's notes, kept as written.

1. Add more language tags to dropdowns for rdfs:label (add all ISO 639-1 language codes to the dropdown)
2. "Draw a relation by dragging from..." -> move to tooltip to make space in interface
3. Make palette and taxonomy view subtabs of left hand panel
4. Make Mini Map half size
5. Class node header height increase to have more space to double-click to zoom
