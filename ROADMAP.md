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

1. Hardening the core, to the definition of done below
2. Multiple superclasses through the UI — the one modelling gap that is a defect, not an addition
3. Mermaid export

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
| A 200-class schema opens, pans, zooms and edits without a dropped frame                    | e2e timing against `buildLarge(200)`                        |
| No edit blocks the main thread for more than one frame                                     | a measured budget in the same test                          |
| A long random editing session leaves the model self-consistent, and undo returns it intact | seeded fuzz over the store, extending the existing harness  |
| Every gesture has a keyboard equivalent                                                    | component tests, plus axe on each panel                     |
| A crash loses no work                                                                      | the error boundary restores the workspace, not just reloads |

| Item                                                                                                                                                                                                                                                                                          | Size |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Measure the canvas and store at scale** — `buildLarge(150–200)` already exercises the model and the serializers, but nothing above them. The canvas and the store have never been measured at that size, so the first task is to find out, not to optimise.                                 | S    |
| **Stop writing the whole workspace on every keystroke** — `editing.ts` calls `saveWorkspace` on every edit, and that `JSON.stringify`s _every project_ into `localStorage` synchronously. Coalesced typing makes it once per character. Debounce it, and write only the project that changed. | S    |
| **Build the ontology index once per change, not three times** — `schemaNodes`, `schemaEdges` and the taxonomy each call `indexOntology` independently, so every edit rebuilds it three times over.                                                                                            | S    |
| **Soak the editing session** — the seeded fuzz harness covers the pure model. Point it at the store instead: long random sessions of create, rename, connect, delete, undo, redo, asserting the invariants hold and that undoing everything returns the starting ontology.                    | M    |
| **Keyboard equivalents for the mouse-only gestures** — re-parenting in the hierarchy tree and dropping a datatype property onto a class are both drag-only. A tool used all day needs both, and a gesture with no keyboard path is also a gesture with no cheap test.                         | M    |
| **Recover rather than reload after a crash** — `ErrorBoundary` offers `window.location.reload()`. That is honest but lossy; the workspace is in `localStorage` and could be restored to the last good state instead.                                                                          | S    |

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

A CORS proxy is not needed, and neither is a desktop app. The trick is that **`owl:imports` never
depends on a fetch**: the export only needs the IRI, which is one triple the user has typed.
Resolving that IRI to a browsable list of terms is a separate, best-effort convenience, and it has
a manual path that always works. Three sources, in order of how much they can be relied on:

1. **The user supplies the file** — drop a `.ttl`, `.rdf` or `.owl` onto the app, or paste it. No
   network, no CORS, works offline and behind a VPN. This is the primary path, not the fallback:
   in finance and insurance the vocabulary that matters is often internal and was never on a
   public URL. The project open/save plumbing already does most of this.
2. **Bundled snapshots of the common vocabularies** — `dcterms`, `skos`, `foaf`, `prov`, `org`,
   `dcat`, `qb`. Each is tens of kilobytes of Turtle and has been stable for years. Lazy-loaded
   chunks, so the initial bundle is untouched and the size budget still holds. Covers the great
   majority of real reuse with no network at all. `schema.org` is the exception at a couple of
   megabytes and would need a pruned index — IRIs, labels and comments — rather than the full file.
3. **Fetch, where it happens to work** — some hosts do send `Access-Control-Allow-Origin`. Worth
   _testing_ rather than designing around: asking for `text/turtle` triggers a preflight that more
   servers fail than fail a plain `GET`, and any third-party vocabulary index is also a
   third-party uptime dependency. A nice-to-have on top of 1 and 2, never the thing they rest on.

**Keeping the desktop option cheap.** The codebase already has the right pattern for this:
`projectstore/persistence.ts` is the only file that knows storage exists. Adding one more adapter
— the only file that knows fetching exists — means a desktop shell later is a swap of two small
modules, not a rewrite. That costs nothing now and buys the whole decision later. See
[Staying a web app](#staying-a-web-app) under the non-goals for why the decision is _later_.

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
   pass, no new dependency, and each piece is one commit. The order inside it barely matters,
   except that measuring at scale comes before optimising anything.
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
