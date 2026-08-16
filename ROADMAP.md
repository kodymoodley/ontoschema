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

Hardening is done bar one thing: the suite still fails on WebKit about one parallel run in three,
and nobody knows why yet. It blocks nothing — CI runs serially and has never seen it — so feature
work resumes, and that stays open.

1. **The four small canvas and interface fixes** — halve the minimap, taller class header, hint
   into a tooltip, new class in the middle of the view. All S, all independent, one pull request
   each.
2. **Say relations and attributes throughout the interface** — early on purpose. It touches every
   label and every test that queries one, and each feature added first makes it bigger.
3. **Multiple superclasses through the UI** — still the one modelling gap that is a defect rather
   than an addition.
4. **Publish to GitHub Pages** — independent of everything else, and it puts the thing in front of
   people, which changes what the next priorities should be.
5. **Mermaid export** — outstanding from the original brief, and the cheapest route from a schema
   into a document.
6. **Every ISO 639-1 language code**, then **palette and taxonomy as subtabs** — small, then the
   first step of the layout work.
7. **Revamp the interface for small screens** — after the subtabs, which is a piece of it.
8. **`owl:imports`, term reuse and read-only imported terms** — the interoperability item, and the
   largest new dependency surface on the list.
9. **Relation edges in the taxonomy view**, and **the 7±2 limits** — both want a design note first,
   for opposite reasons: one risks the very legibility that makes the view worth having, the other
   is four features in a sentence and would invalidate the bundled examples.

The reasoning is in [Proposed running order](#proposed-running-order) at the foot of the file.

---

## Hardening the core

The tool should do one thing completely rather than several things adequately. Before any new
surface area, schema editing itself has to be robust, stable and responsive at the sizes real
work reaches. This section is the current phase.

**Definition of done** — the phase ends when all of these hold, each proved by a test that runs
in `npm run verify`:

| Bar                                                                                        | How it is proved                                           |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| A 200-class schema opens, pans and zooms without a dropped frame                           | `scale.spec.ts` — **met**: a steady 16.7ms frame           |
| No edit blocks the main thread for more than one frame                                     | `scale.spec.ts` — **met**: a typical run misses no frame   |
| A long random editing session leaves the model self-consistent, and undo returns it intact | `editingStress.test.ts` — **met**, including typing bursts |
| Every outcome is reachable by keyboard                                                     | `keyboardRoutes.spec.ts` — **met**, walking by Tab alone   |
| A crash loses no work                                                                      | `ErrorBoundary.test.tsx` — **met**: queued writes flushed  |
| The suite passes on all three engines without a retry                                      | **not met** — see the WebKit flake below                   |

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Size |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| ~~**Measure the canvas and store at scale**~~ — _done, `tests/e2e/scale.spec.ts`._ At 200 classes: opens in 405ms; pan and zoom hold a steady 16.7ms frame, because the viewport moves a CSS transform rather than re-rendering; **one keystroke loses 67ms of main thread and writes 194kB of JSON**. The canvas is not the problem. The edit path is.                                                                                                              | —    |
| ~~**Stop writing the whole workspace on every keystroke**~~ — _done, `savequeue.ts`._ Was 7 writes and 1.4MB for a 7-character rename; now one write once typing stops, bounded so work is never unsaved for long, and flushed when the page is hidden.                                                                                                                                                                                                              | —    |
| ~~**Build the ontology index once per change, not three times**~~ — _measured and dropped._ `indexOntology` costs **0.077ms** on a 200-class ontology and the whole derive costs 0.29ms, so doing it three times was 0.2ms of an edit that cost 40. Untidy, not slow, and not worth the churn during a phase about stability. The edit cost turned out to be handing React Flow 200 new nodes and 199 new edges per keystroke, which is fixed.                       | —    |
| ~~**Soak the editing session**~~ — _done._ The fuzz already drove the store; it now also annotates, renames properties and changes ranges, and three invariants were added — ranges stay recognised, annotation terms stay resolvable, and every class appears in the hierarchy exactly once. Undo across a burst of typing is covered, and the fifty-step history limit is stated rather than assumed.                                                              | —    |
| ~~**Keyboard equivalents for the mouse-only gestures**~~ — _done, differently._ Each drag already had a control in the inspector doing the same thing, so nothing was built; six tests now walk to each by Tab from the top of the page and drive it with the keys. Re-parenting is the **Superclass** select, property re-parenting the **Superproperty** select, and property reuse the **Add this attribute to a class** select.                                  | —    |
| **Find the WebKit flake in the end-to-end suite** — _investigated, not solved. See [What is known about the WebKit flake](#what-is-known-about-the-webkit-flake)._ Roughly one full parallel run in three or four fails on WebKit with an actionability timeout waiting for an element to be _stable_. Never reproduced outside a full mixed-engine run, which makes each attempt a three-minute gamble. Nothing is blocked: CI runs serially and has never seen it. | M    |
| ~~**Recover rather than reload after a crash**~~ — _done._ Batching the writes had quietly made the crash panel's promise false: the last seconds of edits were still queued. The boundary flushes them before it logs or renders, so the workspace on disk is current by the time the panel claims it is.                                                                                                                                                           | —    |

## Editing on the canvas

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Size |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| ~~**Focus an empty class at the right size**~~ — _done, and it was larger than written here._ The entry blamed the placeholder reflowing and said classes with attributes were unaffected. Both were wrong. Focus read React Flow's record of the node's size, which is seeded from the estimate before anything is measured and afterwards lags a frame behind any change to what the node holds. So an empty class was framed from its 100px estimate against a real 131px and filled 46%, and a class focused just after gaining its first attribute was framed from the 131px it measured while empty against the 85px it had shrunk to, filling 22% — the CI flake. Focus measures the rendered box now, which cannot lag. | —    |
| ~~**Rename an attribute in place**~~ — _done._ Double-click or double-tap a datatype property row and edit it there, matching the class header in size, type and select-on-open. A rename reaches every class holding the property, and the field says how many while it is open. F2 opens the same editor from the keyboard. The double-tap had to be recognised by hand: React Flow makes nodes draggable, and only Chromium synthesises a double-click from two taps on one.                                                                                                                                                                                                                                                 | —    |

### What is known about the WebKit flake

Written down because the next attempt should not start from nothing. None of this is a cause yet.

**Measured.** Six failures across roughly ten full parallel runs, in two specs: the Export tab in
`stressWorkflows`, and four at once in the narrow-viewport drawer block of `responsive`. Always
WebKit. Always the same message — waiting for an element to be visible, enabled and _stable_.

**Ruled out.** WebKit alone is clean: three full runs, and `stressWorkflows` at eight workers
repeated three times. `responsive` alone is clean at six repeats. It has never appeared except in a
full run across all three engines, which is what makes it expensive to chase.

**Not the load, or not only the load.** Halving the workers did not remove it, and the one failing
run at half parallelism failed four tests in the same describe block at once. Starvation would
scatter failures across unrelated specs, which is what the eight-worker runs did. Two different
shapes of failure are probably being counted as one thing here.

**One element measured directly.** The Export tab's bounding box is identical across thirty
consecutive frames, and its only transition is `background` and `colour`, neither of which moves
it. So at least that instance is not the app animating. The drawer tests are a different case: the
drawer has a real `transform 180ms` transition, which does move a box, and a stability check has
something genuine to wait for there.

**Untried.** Playwright can emulate `prefers-reduced-motion: reduce`, which the shell already
honours by dropping the drawer transition. That would remove one known source of movement from the
suite, at the cost of no longer exercising the animated path. It is a trade rather than a fix, and
it would not explain the Export tab at all.

### Mutation testing, and the number to compare against

Coverage says which lines ran. Mutation testing changes the code on purpose and asks whether any
test notices, which is a different and harder question. It is scoped to `src/serialization` because
those writers are hand-written and tested mostly by example, and it is run by hand with
`npm run mutation` rather than in CI — it takes about 90 seconds and its answer changes slowly.

**Baseline: 79.3%** — 211 mutants killed, 55 survived, on 2026-08-09. It was 71.7% when the tool was
first pointed at the module; the two survivors worth fixing were quote escaping inside XML
attributes and the sorting that keeps an export byte-stable, both now covered.

The number is here to tell drift from noise, not to be maximised. The 55 that remain are format
labels and human-readable descriptions that no test should assert, and equivalent mutants — changes
no possible input can distinguish, such as `hash >= 0` against `hash > 0`. Writing assertions to kill
those would make the suite worse, because each one couples a test to how the code is written rather
than to what it must do. A run that comes back materially _below_ 79.3% means real coverage was
lost; a run slightly above means someone tested something new. Neither is a target.

## Modelling power

Everything here stays inside the TBox, which is the line the project has drawn from the start.

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Size |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Cap a schema at 7±2 per module** — nine classes to a module, nine modules, so eighty-one classes; in-degree and out-degree of five, total degree six, and edges capped at 1.5× the node count. Refuse an import that breaks the limits, or offer to extract a sub-module that respects them, and say plainly that larger ontologies are meant to be several files joined later in a tool like Protégé. **Not one piece of work**, and the examples violate it today — the music schema alone has thirteen classes — so it needs a design note and a plan for them before any code. _(todo 9)_ | L    |
| **Multiple superclasses in hierarchy and canvas** — _verified: the model allows it, the UI does not._ `OntologyClass.superClassIds` is a list, `addSubClassOf` appends, and the class node already renders `⊂ Vehicle, Asset`. But every UI path goes through `setSuperClass`, which **replaces** — both the inspector's single `<select>` and the hierarchy tree's drag-to-reparent. Needs a multi-value control in the inspector and an add-a-parent gesture in the tree distinct from move-a-parent.                                                                                         | M    |

## Export and interop

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Size |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Mermaid diagram export** — asked for in the original brief and still not built. The subclass edge already draws the hollow triangle Mermaid uses, so the visual vocabulary matches. I love the neatness of the taxonomy diagram tab but no non-subclass edges are there which could be the reason they look so neat. _Split out from PlantUML and sized down: it is a text serializer over the model the four existing writers already share, and adds no dependency._                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | S    |
| **PlantUML diagram export** — the same walk over the model, a second grammar. Worth doing only if Mermaid proves the demand.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | S    |
| **Specify owl:imports for external vocabs from URL** — OntoSchema does not need to load the entire vocabulary into the canvas. Just maintain a cache or memory or localStorage where you load the external ontologies and in the interface all I want is a way to reuse terms that I WANT from those vocabs. I want terms that I don't use to be completely hidden and invisible. But then I would need a way to find or discover terms I need. Perhaps dropdown or search box with BM25 or something like that. Be clever and elegant with this in the interface and use your ontology engineering expertise to judge the best method. _Design settled: no proxy, and no fetch on the critical path — see [Resolving external vocabularies](#resolving-external-vocabularies) below._ **Imported terms are read-only**: an axiom or definition that came from PROV-O, PAV or DCAT cannot be edited or redefined here, or the schema quietly disagrees with the vocabulary it claims to import. Note the tension to settle first — SKOS appears on the todo list as something to import, and is excluded above as a modelling vocabulary. _(todo 10)_ | L    |
| ~~**SHACL conversion and export**~~ — _already built._ Every usage becomes a named `sh:PropertyShape`, several targets on one path become a single `sh:or`, and the Export panel can switch the OWL/RDFS axioms off. Unticking axioms and downloading `.ttl` already gives a shapes-only Turtle file. See [Two export layers](README.md#two-export-layers). What is missing is not the export but the **vocabulary of constraints** — see the note below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | —    |

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

| **Halve the minimap** — it takes more of the canvas than it earns. Pure CSS. _(todo 4)_ | S |
| **Give the class header more height** — a bigger target for the double-click that focuses. Worth knowing it is a preference rather than a fix: the gesture failing on a new class was a timing race, since corrected, and the header is already 37px. _(todo 5)_ | S |
| **Put a new class in the middle of the canvas** — clicking the palette currently drops one in the next free grid slot, which walks away from where you are looking. It should land in the middle of the current view. _(todo 7)_ | S |
| **Draw relation edges in the taxonomy view** — it shows only subclass links today. Worth pausing on: that is _why_ the taxonomy tab reads cleanly, as noted against the Mermaid item, so this trades legibility for completeness. A toggle may be the answer rather than always drawing them. _(todo 11)_ | M |

## Editing workflow

| Item                                                                                                                                                                                                                                                                                                                                     | Size |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Multi-select** — box-select several classes, then move or delete them together.                                                                                                                                                                                                                                                        | M    |
| **Duplicate a class** — with its attributes, as a starting point for a sibling.                                                                                                                                                                                                                                                          | S    |
| **Schema diffing (given two loaded schemas) to compute and generate changelog entries using the Keep a Changelog standard** — governance for a vocabulary that other teams depend on. Sized up from S: it needs two ontologies loaded at once, a structural diff that survives renames, and a mapping from diff to changelog categories. | L    |

| **Offer every ISO 639-1 language code** — the tag field is free text with a short list of suggestions behind it, so this is the list rather than the control: about 184 entries in place of fifteen. _(todo 1)_ | S |
| **Move the "draw a relation by dragging" hint into a tooltip** — it is a paragraph of standing text in the palette, and the space is worth more than the sentence. _(todo 2)_ | S |
| **Make the palette and the taxonomy tree subtabs of the left panel** — they are stacked today, so both are cramped and neither is whole. _(todo 3)_ | M |
| **Say relations and attributes throughout the interface** — rather than object properties and datatype properties. The exported RDF keeps `owl:ObjectProperty`, since that is what the vocabulary calls it; this is only what the user reads. Wide but shallow: every label, tab, aria-label and the tests that query by them. Cheaper the earlier it happens, because every later feature adds more labels to rename. _(todo 8)_ | M |
| **Revamp the interface for small screens** — shrink the header items to fit, bring the canvas zoom controls into view, and give the palette and taxonomy tree sliding drawers of their own. Drawers exist for the two side panels already, so this extends a pattern rather than inventing one. First step is to confirm what is actually off-screen: nothing in the canvas stylesheet hides the controls at any width. _(todo 6)_ | L |

## Housekeeping

| Item                                                                                                                                                                                                                                                                   | Size |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Export and import a whole workspace** — save/open works per project; there is no way to move all of them between machines in one file.                                                                                                                               | S    |
| **Undo across a project switch** — history is per session, and switching projects loses it silently. Sized up from S: making it per-project means re-keying `history.ts` and deciding what a deleted project's history does.                                           | M    |
| **Cross-tab safety** — two tabs on the same workspace both write `localStorage` and the last one wins. Worth splitting: _detecting_ it with a `storage` listener and warning is **S**; merging the two versions is **L**. Do the first, and probably never the second. | S    |

---

## Shipping

| Item                                                                                                                                                                                                                                                                                                                                                                     | Size |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| **Publish the app to GitHub Pages** — built in Actions and pushed to a public repository, the way `vichara` and `vichara-site` already work, so the source can stay private. Two consequences worth deciding on first: the app becomes public, and a public repository gets branch protection for free, which is the assumption the CI path filter rests on. _(todo 12)_ | M    |

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

Filed into the sections above, each entry tagged with its number so the two can be matched. The
list as originally written is in the git history; ask and it comes back.

| #   | Now lives in           | As                                                       | Size |
| --- | ---------------------- | -------------------------------------------------------- | ---- |
| 1   | Editing workflow       | Offer every ISO 639-1 language code                      | S    |
| 2   | Editing workflow       | Move the "draw a relation" hint into a tooltip           | S    |
| 3   | Editing workflow       | Palette and taxonomy tree as subtabs                     | M    |
| 4   | Canvas and readability | Halve the minimap                                        | S    |
| 5   | Canvas and readability | Give the class header more height                        | S    |
| 6   | Editing workflow       | Revamp the interface for small screens                   | L    |
| 7   | Canvas and readability | Put a new class in the middle of the canvas              | S    |
| 8   | Editing workflow       | Say relations and attributes throughout the interface    | M    |
| 9   | Modelling power        | Cap a schema at 7±2 per module                           | L    |
| 10  | Export and interop     | Folded into the `owl:imports` item, plus read-only terms | L    |
| 11  | Canvas and readability | Draw relation edges in the taxonomy view                 | M    |
| 12  | Shipping               | Publish the app to GitHub Pages                          | M    |

Anything new still goes here first. Sizing and sequencing it is a separate step, done on request.
