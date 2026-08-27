# OntoSchema — roadmap

Where the project is going. One line per item: what it is, why it is worth doing, and roughly
how big it is (**S** a sitting, **M** a day or two, **L** a project in its own right).

**Only what is left to do.** A finished item is deleted from here rather than struck through:
what a feature _does_ belongs in the [README](README.md), and why it is built the way it is
belongs in the code that does it, which is where anyone about to change it will look. The one
exception is [Decided against](#decided-against-and-why), for work that was dropped rather than
built — a decision not to write code leaves no code to carry it.

Grouped by theme, not by order. The order lives in **Next up** below, and is the only part of this
file that claims to be a commitment.

---

## What this tool is for

OntoSchema is for the terminology layer of a linked data engineering workflow: the schemas that
semantic layers are built on, in a business context.

The work it comes from looks like legal compliance checking, RAG for chatbot answers that can be
explained, building validation, and interoperability and provenance infrastructure for
heterogeneous data in finance, insurance and pension firms. The common pattern is the same each
time. A lightweight terminology is needed first; data from Excel, CSV or SQL is converted into RDF
triples against it and loaded into a triple store with SHACL constraints; then SHACL validation
says which data is acceptable and which is not. Sometimes the job is harmonising data across
departments and formats instead. Sometimes it is modelling the inclusion and exclusion criteria
for insurance coverage rules that are buried in free-text PDFs.

The gap is in the tooling. Ontology editors are proprietary, or dated, or so feature-packed that
the learning curve costs more than the modelling does. What was wanted was a lightweight schema
editor for building RDF/OWL vocabularies that a semantic data engineering workflow can use.

---

## Next up

**Everything sequenced is done.** A schema saves and opens as ordinary RDF — Turtle or RDF/XML,
axioms and SHACL shapes and the canvas layout in one file, with a report of what a foreign
document left behind. The inspector is one scrolling panel that opens on selection at every width,
its metadata is an ordinary form with the vocabulary behind a switch, and both side panels fold
away. The audit is done and every finding in [AUDIT.md](AUDIT.md) is closed.

**One item is sequenced and it is not ready to start**, which is the point of saying so here:

1. **`owl:imports`, term reuse and read-only imported terms** (todo 10) — last by decision rather
   than by size. It is the largest new dependency surface on the list and the only item that makes
   this tool depend on vocabularies it does not control. It wants a design note before any code;
   most of that note is already written, under
   [Resolving external vocabularies](#resolving-external-vocabularies).

**Filed, and deliberately not sequenced.** Neither is a commitment until it appears above:

- **Harden the layout annotation** (todo 20) — owed work rather than wanted work. The positions
  shipped with the happy path tested and little else, and the entry below lists exactly what is
  untested so the debt stays legible. Parked at the back of the queue by the owner.
- **Nine, three times over** (todo 9) — a project rather than an item, decided in principle: nine
  classes to a module, nine modules to a group, nine groups to a file, so 729 classes and the app
  refuses more. A design note comes first and it has five things to answer, listed under
  [Modelling power](#modelling-power).

Why the order is what it is: [How work is ranked](#how-work-is-ranked) at the foot of the file.

---

## Hardening the core

The tool should do one thing completely rather than several things adequately. Before any new
surface area, schema editing itself had to be robust, stable and responsive at the sizes real
work reaches.

**This phase is finished.** Every bar below is met and stays met, because each is a test in
`npm run verify` rather than a judgement anyone has to make again. Kept here as the standard a
later phase is held to, not as work outstanding:

| Bar                                                                                        | How it is proved                                           |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| A 200-class schema opens, pans and zooms without a dropped frame                           | `scale.spec.ts` — **met**: a steady 16.7ms frame           |
| No edit blocks the main thread for more than one frame                                     | `scale.spec.ts` — **met**: a typical run misses no frame   |
| A long random editing session leaves the model self-consistent, and undo returns it intact | `editingStress.test.ts` — **met**, including typing bursts |
| Every outcome is reachable by keyboard                                                     | `keyboardRoutes.spec.ts` — **met**, walking by Tab alone   |
| A crash loses no work                                                                      | `ErrorBoundary.test.tsx` — **met**: queued writes flushed  |
| The suite passes on all three engines without a retry                                      | **met** — 25 consecutive parallel runs, no retry           |

## What the end-to-end suite has taught us

Two findings that outlived the work that produced them, and that would otherwise have to be
rediscovered: what the WebKit flake was and was not, and what a mutation score on this codebase
actually means.

### What was known about the WebKit flake

Kept in full although the flake has stopped appearing, because nothing here was disproved — it was
never explained, only outlived. If it comes back, this is the ground already covered, and none of
it is a cause.

**Why it is considered gone.** Twenty-five consecutive full parallel runs with no failure and no
retry, in batches of three, ten and twelve on 2026-08-16. At the rate recorded below — about one
run in three or four — a streak that long lands somewhere between one chance in a thousand and one
in twenty thousand, depending which end of that rate is real. Either way it is evidence the flake
stopped, and no evidence whatever about why.

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
test notices, which is a different and harder question. It covers the two pure layers —
`src/ontologymodel` and `src/serialization` — and runs by hand with `npm run mutation`, about six
minutes, because its answer changes slowly.

**80.5% combined**, held by a `break` threshold of 79 in `stryker.config.json`, where the
reasoning sits next to the number. It is a ratchet against regression, not a target: what still
survives is mostly the text inside an error message or a default behind a lookup that cannot miss,
and writing assertions for those would couple tests to how the code is written rather than to what
it must do. The audit took the model from 77.2% to 84.0% by killing the ones that stood for
something real; [AUDIT.md](AUDIT.md) lists what they turned out to be.

## Modelling power

Everything here stays inside the TBox, which is the line the project has drawn from the start.

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Size |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Nine, three times over — a limit the app enforces** — **parked to the back of the queue** as a project with subfeatures rather than an item, but decided in principle. Nine classes to a module, nine modules to a module-group, nine module-groups to a schema: **729 classes to a file**, and the app refuses more. The reasoning is a design philosophy rather than a technical limit — past 729 classes in one file you are almost certainly overcomplicating the conceptualisation and should be breaking the system into subsystems anyway, and anyone who disagrees can build several files here and sew them together in Protégé. Modules are drawn the way the taxonomy view already draws them: a box around a group, and **you do not have to see what is inside**. That is the C4 idea — zoom out and the node count falls. Edges are capped by **directed graph density of 0.25**, which is 18 edges for a module of nine. _(todo 9)_ | L    |

<!-- prettier-ignore -->
> **Nine, three times over: what still has to be decided.** The principle is settled; these are the
> parts that a design note has to answer before any code, and two of them were found by checking
> the arithmetic rather than by reading the sentence.
>
> **Decided: the same rule at every level, counting arrows between boxes.** The limit is about what
> you see at one altitude, not about relations in the model. Three levels fall out of nine three
> times over — a module of classes, a group of modules, a schema of groups — and the same rule at
> each means **every view has at most nine boxes and eighteen arrows**. That is the C4 property made
> literal, and it is what "zoom out so the node count falls" was asking for.
>
> An arrow means *these two boxes are related somehow*, not *this is one relation*. Two modules
> joined by forty class-to-class relations are one arrow when you are looking at modules, because
> that is the honest picture at that altitude. So the limit bites on **how many boxes touch each
> other, not on how much they say to each other**: once two modules are connected, further
> relations between them are free.
>
> Why not count crossing relations individually: the number being enforced would be invisible at
> the level you are looking at, so a refusal could not be explained by anything on screen.
>
> **Density therefore has to be per level, or it does nothing.** 0.25 of a directed graph is
> `0.25 × N × (N-1)` edges. At nine boxes that is 18, which is the number intended, and it is the
> same 18 at all three levels because every level has nine boxes. Applied to a whole schema of 729
> classes it would allow **132,678** — far more than the 13,122 that nine-per-module already
> permits, so a schema-wide density rule is no rule at all.
>
> **Every bundled example breaks the rule today**, so all five have to be re-cut into modules
> before the limit can be enforced: automotive 17 classes, insurance 16, university 16, recipes 15,
> music 14. That is content work and it moves the e2e assertions that count them.
>
> **Two items on this list are already part of this one.** _Grouping in the schema view_ draws
> bounding boxes per module, and the _subschema filter_ hides everything outside a chosen set;
> both are subfeatures of this rather than neighbours of it, and should be folded in when the
> design note is written.
>
> **What happens on import.** A foreign file of two thousand classes is the ordinary case, not the
> edge case. Refusing to open it, opening it and refusing to save, or offering to cut it into
> modules are three different products, and the import rules as they stand keep everything.

## Export and interop

<!-- prettier-ignore -->
> **What a saved file is, and why.** Axioms, the SHACL shapes, and the canvas layout, in one
> document that opens again here and reads as ordinary RDF anywhere else.
>
> The shapes are in it because the axioms cannot carry the schema on their own. `rdfs:domain` and
> `rdfs:range` name both ends of a relation but not which end went with which, so a relation drawn
> between two pairs used to be saved as a union and read back as all four — the insurance example
> returned `MotorPolicy insures Dwelling`, which nobody had drawn. A shape is per class, so it
> says exactly what was drawn. With the shapes present the union has nothing left to do and is not
> written, which is what takes every blank node and `rdf:first` cell out of a saved file.
>
> Each end is judged on its own: a relation drawn from one class to three still states its domain,
> because that end is exact. A document written *without* shapes — a foreign file, or a request
> for axioms alone — still gets the union, because then it is the best that file can do, and it
> has to be an **anonymous** class: a named one carrying `owl:unionOf` is discarded by real OWL
> parsers, measured with owlready2 rather than assumed.
>
> The cost is size: the insurance schema roughly doubles, 10.2 kB to 21.5 kB. Files saved by
> earlier versions still open, cross product and all.

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Size |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **PlantUML diagram export** — the same walk over the model, a second grammar. Worth doing only if Mermaid proves the demand.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | S    |
| **Harden the layout annotation** — _parked to the back of the queue._ The positions half of todo 17 shipped with tests that cover the happy path and five malformed strings, which is not the same as being robust. What is actually untested: **scale** — a few hundred classes put a single literal of tens of kilobytes on one line, and nothing checks what that does to the writers, to the file, or to the time it takes; **the decoder against real hostility** — `__proto__` and `constructor` as keys, coordinates that are `NaN`, `Infinity`, `1e308` or a string that parses as a number, an entry whose key is not an IRI at all, a value nested arbitrarily deep; **partial recovery** — a layout naming three classes that no longer exist and omitting two that do, which is the ordinary case after editing a file elsewhere and the one the decoder has never been asked about; **the round trip end to end**, which cannot be finished until the importer exists, so the decoder is dead code the suite exercises only in isolation. Also **not mutation-tested**: Stryker is pointed at `src/serialization/` alone, so `layout.ts` has no measured test strength at all, and the obvious mutants — dropping the rounding, dropping the sort, inverting a guard — would very likely survive. Widen the mutation scope to cover it and hold it to the same bar. _(todo 20)_          | S–M  |
| **Specify owl:imports for external vocabs from URL** — OntoSchema does not need to load the entire vocabulary into the canvas. Just maintain a cache or memory or localStorage where you load the external ontologies and in the interface all I want is a way to reuse terms that I WANT from those vocabs. I want terms that I don't use to be completely hidden and invisible. But then I would need a way to find or discover terms I need. Perhaps dropdown or search box with BM25 or something like that. **The ranking is already built**: `src/search/` ranks the open schema for todo 29, and its BM25 half knows about documents with weighted fields rather than about classes, so this item brings a corpus to it rather than writing a second one. Be clever and elegant with this in the interface and use your ontology engineering expertise to judge the best method. _Design settled: no proxy, and no fetch on the critical path — see [Resolving external vocabularies](#resolving-external-vocabularies) below._ **Imported terms are read-only**: an axiom or definition that came from PROV-O, PAV or DCAT cannot be edited or redefined here, or the schema quietly disagrees with the vocabulary it claims to import. Note the tension to settle first — SKOS appears on the todo list as something to import, and is excluded above as a modelling vocabulary. _(todo 10)_ | L    |

> **Where the layout goes.** One declared `owl:AnnotationProperty` in this app's own namespace,
> carrying every position, keyed by **IRI** — internal ids never reach the file, so they cannot be
> the key. A class with no entry is placed the way a new one is. The cost is that any move
> rewrites the whole line, so a textual diff of a saved `.ttl` says all of it changed; a
> triple-level diff sees one annotation and can ignore it by predicate. Checked against a real OWL
> parser: the term reads as an annotation property and the classes and unions are untouched. Its
> testing is **owed, not done** — todo 20 above.
>
> **What "schema-level" means on import.** Classes and their `rdfs:subClassOf` hierarchy, with
> annotations. Attributes, whatever their range — an `xsd` datatype is kept and anything else
> becomes `xsd:string`, so the attribute arrives with its name and its class rather than being
> dropped over a detail this tool does not model. That is the one import rule that **rewrites**
> rather than discards, so a foreign ontology opened and saved here comes back changed, and the
> report says so. Relations, but only where both ends are known: a subproperty qualifies if it has
> both itself or inherits them from an ancestor. The ontology IRI and prefix if stated. Everything
> else is dropped — individuals, restrictions, property chains — and the report counts what went.
>
> **One project per file, and the answer to it: a workspace backup.** A Turtle document is one
> ontology, so saving as RDF is per project by construction. _Back up everything_ and _Restore a
> backup_ carry the whole workspace, which is the one thing RDF cannot: several projects, exact
> state, no lossy import rules. Restoring replaces rather than merges, behind a confirmation that
> names what is about to go. _(todos 21, 22)_

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

<!-- prettier-ignore -->
> **Relations are drawn rigid**, the same right angles as the subclass links in the taxonomy
> view. What that does not buy is a line that avoids the classes in between, which is what **edge
> label collision avoidance** below is really about.

> **Shipped: tidy-up / auto-layout for the schema view.** It turned out to be a bug before it was
> a feature. Positions ride in a saved file as this app's own layout annotation, and a `.ttl`
> written anywhere else has none — so `ontologyFromTriples` fell back to `{ x: 0, y: 0 }` for
> every class and an imported schema opened as one illegible pile. `arrangeSchema` ranks the
> classes with dagre and the app runs it when a document arrives unplaced, which is a state no
> amount of dragging can produce: two classes on the exact same coordinate.
>
> Ranked by the **relations**, left to right, not by the hierarchy. Subclass links are
> deliberately not drawn on this canvas, so ranking by them would have produced rows with no
> visible reason for them; they go in as lower-weight edges instead, which keeps a child near its
> parent without letting the hierarchy overrule the drawn edges. Disconnected groups are laid out
> separately and packed with wrapping, the way the taxonomy view packs its modules — handing
> dagre a disconnected graph gets one enormously wide row.
>
> The same function is on a button (Shift+A), deliberately **deterministic** rather than the
> randomised re-roll that was asked about. There is no reason to expect a second roll to beat the
> first, and a schema layout is something you invest in by dragging — a button that discards that
> for a random alternative is one people learn not to touch. Pressing it twice lands in the same
> place, and it is one undo away. The arrangement an import arrives with is **not** in the undo
> stack: an undo that puts every class back in a pile is not a state anyone asked to return to.

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Size |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Edge label collision avoidance** — a relation's label can park on top of an unrelated class. Straight edges between aligned classes pass over whatever is between them; the label makes it obvious.                                                                                                                                                                                                                                                                                                                                                                             | M    |
| **Subschema filter** — the first thing that bites past about thirty classes, and cheaper than any amount of auto-layout, because hiding is the only thing that scales. Do it before the layout and grouping items below; it may make them unnecessary. Narrow the canvas to a chosen set of classes and relations, or to one class and what it touches, and hide the rest. The answer to a spaghetti diagram that no amount of layout fixes, and the only thing that actually scales. _Was listed twice: also appeared under Editing workflow as "filter schema for subschemas"._ | M    |
| **Grouping in the schema view** — bounding boxes per taxonomy module, as the taxonomy view already does.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | M    |

## Editing workflow

| Item                                                                                                                                                                                                                                                                                                                                     | Size |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Multi-select** — box-select several classes, then move or delete them together.                                                                                                                                                                                                                                                        | M    |
| **Duplicate a class** — with its attributes, as a starting point for a sibling.                                                                                                                                                                                                                                                          | S    |
| **Schema diffing (given two loaded schemas) to compute and generate changelog entries using the Keep a Changelog standard** — governance for a vocabulary that other teams depend on. Sized up from S: it needs two ontologies loaded at once, a structural diff that survives renames, and a mapping from diff to changelog categories. | L    |

### Small screens

Three changes were ordered by the owner and built: a full-screen button to be rid of the address
bar, the header actions folded into one menu, and the entities drawer halved to `min(160px, 60vw)`
so the canvas stays visible beside it. The inspector was then made usable at 320px, and the
drawers were moved below the canvas toolbar, which they had been covering — undo, redo and find
were unreachable for anyone with something selected.

Two numbers worth keeping, because both were counter-intuitive and both were measured rather than
reasoned about. The inspector's problem at 320px was **not** the type scale, which already steps
down below 1024px: a row could not shrink, so one long attribute name laid the whole panel out
203px wide inside a 159px pane. And a drawer at 320px covering 82% of a portrait phone is why it
is `min(160px, 60vw)` rather than half the screen — creating an attribute put the new attribute
behind the panel that created it.

The rest of the phone design — a bottom sheet in portrait, the taxonomy as the default tab,
reclaiming the landscape chrome — is unbuilt on purpose; see [Decided against](#decided-against-and-why).

## Housekeeping

| Item                                                                                                                                                                                                                                                                   | Size |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
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

## Decided against, and why

Work that was proposed here and then not done, or done by removing something instead. It is kept
because nothing else records it: a decision _not_ to write code leaves no code to comment.
Everything else that shipped has been deleted from this file — what a feature does is in the
[README](README.md), and why it is built the way it is sits in the code that does it.

**Rebuilding the ontology index once per change** — _measured and dropped._ `indexOntology` costs
**0.077ms** on a 200-class ontology and the whole derive costs 0.29ms, so doing it three times was
0.2ms of an edit that cost 40. Untidy, not slow, and not worth the churn during a phase about
stability. The edit cost turned out to be handing React Flow 200 new nodes and 199 new edges per
keystroke, which is fixed.

**Hunting the WebKit flake** — _stopped looking, on evidence rather than on a fix._ It used to fail
roughly one full parallel run in three or four; it then went twenty-five consecutive runs without
appearing, which at the kindest reading of that rate would happen by chance about once in a
thousand attempts. **Nobody found a cause**, so this is not a fix. See
[What was known about the WebKit flake](#what-was-known-about-the-webkit-flake), which stays as
written in case it returns.

**Palette and taxonomy as subtabs** — _dropped by the owner, not parked._ It had been filed since
the beginning and measured twice: the palette takes 36% of an 852px panel to hold three buttons,
and the tree already has a tab strip of its own, so subtabs meant a second strip above it. Three
shapes were drawn up and none was chosen. Removed from the list entirely rather than left to be
re-read every time someone asks what is next.

**Subclass links on the schema canvas** — _removed, by the owner._ They were drawn there as well
as in the taxonomy view so the two views could not disagree about what the model holds. In
practice they were a second set of lines through the same crowded middle, saying what each class
box already says in its own header, and the taxonomy view shows a hierarchy far better because it
lays one out rather than drawing it over wherever the classes were dragged. The schema canvas now
draws relations only. Nothing changed in the model or in any export.

**The taxonomy view's caption** — _done by deletion._ "Laid out automatically — one module per
root class, superclasses above" described a picture that explains itself, in a toolbar where
every other character is a control. Its removal also settled a smaller complaint: prose that comes
and goes was moving the relation switch beside it, so the switch now sits ahead of the hint.

That last part was only half a fix, and adding a longer hint found the other half. The toolbar is
a flex row, so a hint too long for the space left makes everything **before** it shrink, and the
switch moved anyway — ordering had bought a guarantee that held only for wording short enough. The
hint now takes the room that is left and never asks for more (`flex: 1 1 0`, `min-width: 0`, and an
ellipsis), so the guarantee holds for any wording rather than by coincidence.

**Comparing two classes in the taxonomy view** — _shipped._ Ctrl or Cmd click adds a class to the
relation layer instead of replacing it, because "what does a Track touch" is half a question and
the other half is what it touches that an Album does not. A plain click narrows back to one, the
canvas clears it, and selecting from the search box or the tree starts again.

The set lives in the canvas, not in the store. Making the app's selection multi-valued was the
obvious route and was turned down: selection drives the inspector, which shows one entity, so it
would have forced "what does the inspector show when three are selected?" — a much larger question
for no benefit to either. The canvas tracks which selections it made itself, because membership was
the first test tried and it is wrong: searching for a class already in the comparison looks exactly
like a Ctrl-click from the canvas, and the set survived a search that should have cleared it.

**A tooltip for the drag-a-relation hint** — _done by deletion._ Put behind a question mark first,
then removed outright: the palette entries already say what each thing is.

**The rest of the small-screen design** — _stopped deliberately._ The three changes the owner
ordered are in; what the design note suggests beyond them — a bottom sheet in portrait, the
taxonomy as the default tab, reclaiming the landscape chrome — is unbuilt on purpose. See
[Small screens](#small-screens).

## How work is ranked

The tool is not trying to be a Swiss army knife. It should do schema editing better than anything
else and stop there, so the ranking question is not "does this add capability?" but **"does this
make the one job more solid, or does it widen the job?"** Solidity first, then the smallest
additions that finish what is already started.

Three rules fall out of that, and they are what produced the order in [Next up](#next-up):

1. **Measure before ranking.** Twice now this changed the answer rather than confirming it. The
   canvas performance worry was retired outright by measuring it, and the index rebuild after it
   — 0.077ms of a 40ms problem — which sent the effort to what was actually costing. The audit
   went the same way: it opened by calling the type scale the reason the inspector was unusable
   on a phone, and measuring found a row that could not shrink.
2. **An item that needs a decision is not ready**, however small it is. It waits in the filed list
   until the decision is made, and the decision gets written down here when it is.
3. **The largest new dependency surface goes last.** `owl:imports` is the only item that makes
   this tool depend on vocabularies it does not control, in a project whose stated virtue is
   having almost no dependencies at all.

Deferred deliberately: the SHACL constraint vocabulary, and with it the question of whether
constraint authoring belongs in this tool at all. See the note under
[Export and interop](#export-and-interop).

## Features todo

Filed into the sections above, each entry tagged with its number so the two can be matched. The
list as originally written is in the git history; ask and it comes back.

| #   | Now lives in       | As                                                                  | Size |
| --- | ------------------ | ------------------------------------------------------------------- | ---- |
| 9   | Modelling power    | Nine, three times over — 729 classes, enforced; parked as a project | L    |
| 10  | Export and interop | Folded into the `owl:imports` item; its ranking comes from 29       | L    |
| 20  | Export and interop | Harden the layout annotation — parked to the back of the queue      | S–M  |

**Done:** 1, 2, 4, 5, 6, 7, 8, 12, 13, 14, 15, 16, 17, 19, 21, 22, 23, 24, 25, 26, 11, 27, 29, 30, 31, 32, 33, 34, 28, 35, 18, 36, 37 — kept as numbers so a commit message naming one can still be resolved.

Anything new still goes here first. Sizing and sequencing it is a separate step, done on request.
