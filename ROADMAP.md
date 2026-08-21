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

**Hardening is done**, and so is everything that was sequenced after it. The headline is that a
schema now **saves and opens as ordinary RDF**: Turtle or RDF/XML, with the layout riding along in
one annotation, the SHACL shapes in a file of their own, and a report of what a foreign document
left behind. The private project format is gone from everyday use, and a workspace backup covers
the one thing RDF cannot carry. The file menu was tidied into four groups on the way through.

What that leaves is short. Neither of the two sequenced items is ready to start, and saying so is
the point of listing them: both want a design note before any code.

1. **Relation edges in the taxonomy view**, and **the 7±2 limits** — both want a design note first,
   for opposite reasons: one risks the very legibility that makes the view worth having, the other
   is four features in a sentence and would invalidate the bundled examples.
2. **`owl:imports`, term reuse and read-only imported terms** — last by decision rather than by
   size. It is the largest new dependency surface on the list, and the only item that makes this
   tool depend on vocabularies it does not control; everything above it improves what is already
   here.

**Filed, and deliberately not sequenced.** None of these is a commitment until it appears in the
list above:

- **Find an entity by name or description** (todo 29) — the last of the inspector arc, and the
  only part of it left. Decided and ready.
- **Harden the layout annotation** (todo 20) — owed work, named as such: the positions shipped
  with the happy path tested and little else.
- **Metadata editing as an ordinary form** (todo 18) — scoped now: the ontology's metadata and an
  entity's details and annotations, and nowhere else. Export keeps its jargon, because the RDF is
  what that panel is for. Waits on a proposal rather than a slot — what the forms hold, in what
  order, under what labels — which the owner approves before any of it is built.
- **Let the side panels slide away on desktop** (todo 30) — ready, but settle it against todo 27
  first: one has selection open the inspector, the other has you close it on purpose.
- **Palette and taxonomy as subtabs** (todo 3) — parked after measuring; the choice of shape is
  the owner's.

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

## Export and interop

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Size |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Harden the layout annotation** — the positions half of todo 17 shipped with tests that cover the happy path and five malformed strings, which is not the same as being robust. What is actually untested: **scale** — a few hundred classes put a single literal of tens of kilobytes on one line, and nothing checks what that does to the writers, to the file, or to the time it takes; **the decoder against real hostility** — `__proto__` and `constructor` as keys, coordinates that are `NaN`, `Infinity`, `1e308` or a string that parses as a number, an entry whose key is not an IRI at all, a value nested arbitrarily deep; **partial recovery** — a layout naming three classes that no longer exist and omitting two that do, which is the ordinary case after editing a file elsewhere and the one the decoder has never been asked about; **the round trip end to end**, which cannot be finished until the importer exists, so the decoder is dead code the suite exercises only in isolation. Also **not mutation-tested**: Stryker is pointed at `src/serialization/` alone, so `layout.ts` has no measured test strength at all, and the obvious mutants — dropping the rounding, dropping the sort, inverting a guard — would very likely survive. Widen the mutation scope to cover it and hold it to the same bar. _(todo 20)_ | S–M  |
| **PlantUML diagram export** — the same walk over the model, a second grammar. Worth doing only if Mermaid proves the demand.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | S    |
| **Specify owl:imports for external vocabs from URL** — OntoSchema does not need to load the entire vocabulary into the canvas. Just maintain a cache or memory or localStorage where you load the external ontologies and in the interface all I want is a way to reuse terms that I WANT from those vocabs. I want terms that I don't use to be completely hidden and invisible. But then I would need a way to find or discover terms I need. Perhaps dropdown or search box with BM25 or something like that. **The ranking is not built here**: todo 29 builds it first over this app's own schema, and this item reuses it. Be clever and elegant with this in the interface and use your ontology engineering expertise to judge the best method. _Design settled: no proxy, and no fetch on the critical path — see [Resolving external vocabularies](#resolving-external-vocabularies) below._ **Imported terms are read-only**: an axiom or definition that came from PROV-O, PAV or DCAT cannot be edited or redefined here, or the schema quietly disagrees with the vocabulary it claims to import. Note the tension to settle first — SKOS appears on the todo list as something to import, and is excluded above as a modelling vocabulary. _(todo 10)_                                                                                     | L    |

> **Decided, in the owner's words, and what each costs.**
>
> **Class positions go in one annotation on the ontology**, not on each class. A single custom
> `owl:AnnotationProperty` in this app's own namespace, carrying every position, keyed by entity
> **IRI** — internal ids never reach the file, so they cannot be the key. Declare the property in
> the document so it stays valid OWL, and place a class with no entry the way a new one is placed.
> The cost is that any move rewrites the whole line, so a textual diff of a saved `.ttl` shows all
> of it changed; a triple-level diff sees one annotation and can ignore it by predicate, which the
> schema-diffing item would do anyway.
>
> **Positions are built.** One declared annotation, keyed by IRI, whole pixels, sorted. Checked
> against a real OWL parser: the term reads as an annotation property and the classes and
> unions are untouched. Its testing is **owed, not done** — see todo 20 above.
>
> **What "schema-level" means on import.** Classes and their `rdfs:subClassOf` hierarchy. All
> annotations. Attributes, whatever their range: an `xsd` datatype is kept as it is, and anything
> else — `rdfs:Literal`, a custom datatype — becomes `xsd:string`, so the attribute arrives with its
> name and its class rather than being dropped for a detail this tool does not model. Worth knowing
> that this is the one import rule that **rewrites** rather than discards: export the file again and
> it will assert `xsd:string` where the original said something else, so a foreign ontology opened
> and saved here comes back changed. Relations, but only where
> **both** a domain and a range are known. Property hierarchies are imported, and a subproperty
> qualifies if it has both itself **or inherits both from an ancestor**. The ontology IRI and
> prefix if stated. Everything else is dropped: individuals, restrictions, unions, property
> chains. Foreign terms arrive through `owl:imports` rather than dangling without context, which
> ties this to the import item — the last thing in the running order — so either that part waits
> or the two are done together.
>
> **Shapes leave the ontology file, and a reused property states its domain as a union.** Three
> parts, and they only make sense together.
>
> The shapes are exported to a file of their own rather than mixed into the ontology, and import
> never reads them — not from a shapes file, not from an ontology that happens to contain some.
>
> **Built, and one thing had to give.** The union must be an **anonymous** class. Measured
> against a real OWL parser (owlready2, reading the app's own RDF/XML, Turtle and JSON-LD): a
> _named_ class carrying `owl:unionOf` comes back as a bare class equivalent to nothing — the
> union triple is discarded — so the domain would assert something meaningless, which is worse
> than asserting nothing. Anonymous, all three syntaxes read back as `Car | Truck`. That cost
> the "deliberately no blank nodes" rule the writers were built on. Blank nodes are now allowed
> in exactly one place, an OWL class expression, and a test names every other blank node as a
> failure. Shapes stay named, since SHACL asks nothing of the kind and a named shape can be
> pointed at, annotated and diffed.
>
> That leaves the ontology file having to carry enough on its own, and today it does not: a
> property used in more than one place is written with no `rdfs:domain` at all, because RDFS
> cannot state the truth. Repeating the domain means intersection — that anything using the
> property is a Company _and_ a School — which is false. So the writer changes: a reused property
> gets `rdfs:domain [ owl:unionOf (…) ]` and the same for its range. That is true, merely weaker
> than the pairing it came from, and it is what makes the property survive a round trip at all.
>
> **What that recovers, and what it does not.** An attribute usage is a class and a property, so a
> union domain names every class it sits on and the attribute comes back exactly as it was. A
> relation usage is a subject, a property and an object; a union gives back both sets but not
> which subject went with which object, so a relation drawn `Car → Dealership` and
> `Wheel → Garage` reopens permitting `Car → Garage` as well. The loss is confined to relations
> used with more than one distinct pairing. Reading the shapes file on import would close it, and
> can be added later without changing anything decided here.
>
> **One project per file, and the answer to it: a workspace backup.** A workspace holds several
> projects; a Turtle document is one ontology, so saving as RDF is per project by construction.
> The gap gets its own menu item rather than a compromise in the save format: **one action that
> writes the entire workspace** — every project, exact state, no lossy import rules — and one
> that reads it back. Two formats still exist, but with jobs that do not overlap: the `.ttl` is
> the document you hand someone, the backup is a snapshot of this browser.
>
> Worth being clear about what the private format is actually for, because it is easy to
> mistake. Day to day nobody saves anything — the workspace already persists to `localStorage`,
> which is why deleting a project says "removed from this browser". The private file's job is
> transfer and backup, not working storage. Keeping it for that job costs nothing and answers
> the one thing RDF genuinely cannot do; keeping it for **everyday saving** is what this item
> set out to end. **Built** — _Back up everything_ and _Restore a backup_, the latter behind a
> confirmation that names what is about to be replaced, and behind a file picker of its own so
> an action that destructive is chosen on purpose rather than arrived at by opening a file that
> turned out to be a backup. Restoring replaces rather than merges, because merging would
> duplicate every project the moment someone restored their own snapshot onto the browser it
> came from. _(todo 21)_
>
> **Import must say what it dropped.** The rules above are lossy by design — individuals,
> restrictions, property chains discarded, non-`xsd` datatypes rewritten to `xsd:string` — and
> once save and open share a format, that becomes everyone's problem: open a colleague's
> ontology, move one class, save, and parts of their file no one ever looked at have been
> silently rewritten. The fix is honesty rather than a format. **Report what was discarded**
> after an import, in plain terms and by count, and make **"save as a copy"** the offered path
> for a file that came from elsewhere rather than overwriting a document the tool only partly
> understands. Cheaper than trying to model everything, and it puts the choice with the person
> who knows what the file is for. **The report is built** — counts in plain words, with what was
> _changed_ kept apart from what was _dropped_, since a thing that is gone gets noticed and a
> thing that is quietly different does not. It says outright that saving writes what was kept
> rather than the file that was opened.
>
> **"Save as a copy" turned out not to be a thing to build.** A browser download never writes back
> to where a file was opened from: it writes a new file, and a name that already exists is suffixed
> rather than replaced. There is no overwrite to prevent, so the protection that matters is the
> sentence the report already carries. _(todo 22)_

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

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Size |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Edge label collision avoidance** — a relation's label can park on top of an unrelated class. Straight edges between aligned classes pass over whatever is between them; the label makes it obvious.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | M    |
| **Tidy-up / auto-layout for the schema view** — the taxonomy view lays itself out with dagre; the schema view never does. A button, not automatic.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | M    |
| **Let the side panels slide away on desktop** — both panels are fixed on a wide screen, so the canvas gets what is left rather than what it needs. Collapsing either should give that space back, and the state should persist. **Settled with todo 27**, which is built: the rule is the same at every width — the inspector is open exactly when something is selected — so a collapse here is undone by selecting something, deliberately. What this item adds is the _left_ panel, which has no such rule, and a way to put the inspector away on a wide screen without deselecting. Note what 27 measured on the way: collapsing the right column automatically shrinks the canvas by 340px on every click, which moves the drawing under the pointer and leaves the focus zoom computing against a width that is about to change. Whatever this item does, it must not do that. Below the three-column breakpoint the panels are already drawers, so this is desktop only. _(todo 30)_ | S–M  |
| **Subschema filter** — the first thing that bites past about thirty classes, and cheaper than any amount of auto-layout, because hiding is the only thing that scales. Do it before the layout and grouping items below; it may make them unnecessary. Narrow the canvas to a chosen set of classes and relations, or to one class and what it touches, and hide the rest. The answer to a spaghetti diagram that no amount of layout fixes, and the only thing that actually scales. _Was listed twice: also appeared under Editing workflow as "filter schema for subschemas"._                                                                                                                                                                                                                                                                                                                                                                                                            | M    |
| **Grouping in the schema view** — bounding boxes per taxonomy module, as the taxonomy view already does.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | M    |
| **Stepped / orthogonal edges as an option** — now that each edge picks a side, right-angled routing is a small step and reads better for dense schemas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | S    |
| **Draw relation edges in the taxonomy view** — it shows only subclass links today. Worth pausing on: that is _why_ the taxonomy tab reads cleanly, as noted against the Mermaid item, so this trades legibility for completeness. A toggle may be the answer rather than always drawing them. _(todo 11)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | M    |

## Editing workflow

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Size |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| **Shrink the inspector's type on a phone** — worth being exact about what is missing, because it is not the type scale. `tokens.css` already drops every step at ≤ 1024px and the inspector is inside that; only the canvas opts back out, deliberately, because a class box is a fixed width whatever the viewport. The problem is that the panel is `min(160px, 60vw)` and 12px body text in a 160px column with a label beside a field is still too much. So this is field layout as much as type — labels above their inputs rather than beside them, tighter rows — and it should be **measured at 320px** before anything is chosen. _(todo 28)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | S    |
| **Find an entity by name or description** — a search box over labels, `skos:definition` and `dcterms:description`, ranked with BM25; a hit selects the entity and opens the inspector on it, and `Ctrl`+`K` reaches it. Wanted from about fifteen classes, which every bundled example already passes. The thing that makes it worth having is the same thing the subschema filter is for: past about thirty classes the taxonomy tree stops being a way to find anything. Two notes. **Decided: the ranking is built here, and todo 10 reuses it.** BM25 already appears on this list for discovering terms in an imported vocabulary; one implementation serves both, and this is the cheaper place to get it right — a corpus we own, of a size we control, with every document already in memory. Todo 10 then brings a vocabulary to an index that works rather than the two arriving together. And **where it goes matters more than the ranking**: the header is full, the left panel is already cramped (see the parked subtabs item), so placement is part of the work rather than a detail of it. _(todo 29)_                                                                                                                                                                                                                                                                                                                                                                                                                                      | M    |
| **Multi-select** — box-select several classes, then move or delete them together.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | M    |
| **Duplicate a class** — with its attributes, as a starting point for a sibling.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | S    |
| **Schema diffing (given two loaded schemas) to compute and generate changelog entries using the Keep a Changelog standard** — governance for a vocabulary that other teams depend on. Sized up from S: it needs two ontologies loaded at once, a structural diff that survives renames, and a mapping from diff to changelog categories.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | L    |
| **Make metadata editing look like an ordinary form** — the tool asks people to know `rdfs:label`, `skos:prefLabel` and `dcterms:description` in order to fill in what are, to them, a name, another name and a description. **Scoped deliberately, by the owner:** this is about the _metadata editing_ surfaces — the ontology's own metadata, and an entity's details and annotations — and nothing else. They should look like the forms any modern web app has: labelled fields in plain words, in a sensible order. The linked data vocabulary becomes plumbing underneath, reached only when someone explicitly wants it. **Jargon stays where it is the subject.** Saving and exporting keep their format names and their preview — anyone downloading a file does need to know what a `.ttl` is, and the whole point of that panel is the RDF. Taking the words out there would hide the thing the feature exists for. **Decided for the datatypes**: every xsd type stays on offer, and each is shown as the part after the prefix — `string`, `integer`, `boolean` — rather than renamed to _Text_ or _Whole number_. The prefix is the jargon; the type names themselves are ordinary words, and translating them would cost an expert the ability to recognise what they are choosing while gaining a beginner very little. **Starts with a proposal**, not with code: what the forms hold, in what order, under what labels, and how the vocabulary is reached when it is wanted. The owner approves that before anything is built. _(todo 18)_ | M    |
| **Make the palette and the taxonomy tree subtabs of the left panel** — they are stacked today, so both are cramped and neither is whole. **Parked on 20 August 2026**, with two things measured that the entry did not know. The palette costs **304px of an 852px panel** at 1440×900 — 36% — to hold three buttons, and the size is the hint sentence under each one, not the buttons. And the tree already has a tab strip of its own (Class, Relation, Attribute), so _subtabs_ means a second strip above it: 60px of tabs in a panel whose complaint is wasted height. Three ways out were drawn up — shrink the palette to one row and add no tabs at all, fold it in as a fourth tab beside the three entity tabs, or nest the strips as filed — and choosing between them is the owner's call, not a detail of the build. _(todo 3)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | M    |

<!-- prettier-ignore -->
> **Todos 25, 26 and 27 are one arc, in that order.** Each is shippable on its own, but together
> they retire the inspector's tab strip: _Export_ has already left, _Metadata_ leaves under 25,
> _Details_ and _Annotations_ become one panel under 26, and 27 then removes the toggle that only
> existed to reveal a panel with nothing in it. Done piecemeal in another order, 27 would strand
> the metadata tab behind a control that no longer opens.

### Small screens: what the app should be on a phone

Written before any code, because this is the one item on the list that is a decision rather than
a fix. Every number below was measured in Chromium at the stated viewport, opening the Music
library example.

#### The order to do this in

Decided by the owner after reading the rest of this note, and it takes precedence over the
sequence proposed further down. Three changes, then stop and ask.

1. **A full-screen button, to be rid of the browser address bar.** The bar is on screen in both
   orientations and costs real estate that nothing else here can win back. **Do this first, then
   pause for testing:** if it is enough, several of the suggestions below stop being worth making.
2. **Fold the header actions into one dropdown menu.** Not a sliding strip along the top — one
   menu, holding as many of the actions as sensibly fit. This is the item already on the roadmap
   as _Collect the file actions into one menu_, brought forward.
3. **Halve the width of the entities panel on mobile.** From 320px to about half that, so the
   canvas stays visible beside it.

**Then stop.** Treat mobile as done at that point and ask before going further.

> **A correction to the measurements below, which point 1 exposes.** The table was taken in a
> headless browser, which has no address bar, so the canvas heights are the best case rather than
> the real one. A portrait phone loses roughly 90px of the 844 to browser chrome and a landscape
> one loses a similar slice of an already short 390. The instinct behind point 1 is right, and the
> figures below understate the problem rather than overstating it.

|                  | Viewport   | Canvas        | Class box | Entities drawer                   |
| ---------------- | ---------- | ------------- | --------- | --------------------------------- |
| Phone, portrait  | 390 x 844  | 390 x 710     | 224 x 177 | 320px wide, **82% of the screen** |
| Phone, landscape | 844 x 390  | 844 x **271** | 224 x 177 | 320px, 38%                        |
| Tablet, portrait | 768 x 1024 | 768 x 905     | 224 x 177 | 320px, 42%                        |

**Four things, and none of them is "the panels are a bit cramped".**

**The drawer is a fixed width.** 320px whatever the screen, which is 82% of a portrait phone. That
is why creating an attribute appears to do nothing: the thing that was just created is behind the
panel that created it. The palette already closes the drawer on use, so the pattern is half
established; the fix is not a narrower drawer but deciding what the drawer is for.

**The class box is a fixed width too.** 224px, which is 57% of a portrait phone. Two classes cannot
sit side by side at any zoom that leaves the text readable, so the schema view — the thing the app
is for — cannot show a relationship in portrait without zooming out past legibility.

**Landscape has no height.** 271px of canvas, after a 48px header, the view tabs and the footer
counts. A class with five attributes is 177px, which is 65% of it. Landscape is not the easier
orientation; it is a different problem.

**Opening an example never fits the view — on any size.** Desktop shows 8 classes of 13 at 100%
zoom, a portrait phone shows 4. This was assumed to be a small-screen bug and is not: it is
general, and a phone is merely where it becomes obvious. Worth fixing on its own, before any of
the above, since it is cheap and helps every user.

**Portrait and landscape want opposite things.** Portrait has width to spare vertically and none
horizontally: a drawer that slides from the side is the wrong shape, and a sheet that rises from
the bottom leaves the canvas visible above it. Landscape has the opposite problem: the chrome
rows are the enemy, and the drawer at 38% is tolerable while the header, tabs and footer are not.

#### The question underneath

Not "how do we fit the desktop layout onto a phone" but **what is this app on a phone at all**.
Three honest answers:

1. **Full parity.** Everything the desktop does. Expensive, and probably bad: drawing a relation
   by dragging between two 224px boxes on a 390px screen is not a gesture that becomes good with
   effort.
2. **Review and light editing.** Open a schema, read it, navigate the taxonomy, rename things,
   add an annotation, export. Authoring the graph — drawing relations, arranging the canvas —
   stays a desktop activity.
3. **Read-only.** A viewer, with editing disabled.

**Option 2 is the recommendation.** It matches what the tool is for: a schema is authored in a
sitting at a desk and then reviewed, discussed and shared far more often than it is drawn. It also
costs least, because it means removing things from the phone layout rather than inventing mobile
equivalents of drag and drop.

It has a consequence worth stating plainly: **the schema canvas stops being the centre of the app
on a phone.** The taxonomy tree is a better default there — it is a list, lists work at 390px, and
it already exists.

#### What follows from that

Written before the order above was decided, and kept because the reasoning still holds. These come
after those three, if they are wanted at all.

1. **Fit the view when a schema is opened.** Cheap, general, and it is why a phone appears to open
   on an arbitrary two classes. **S**
2. **Make the entities panel a bottom sheet in portrait**, sized to leave the canvas visible above
   it, and close it on any action that changes the canvas — which the palette already does. **M**
3. **Default to the taxonomy tab below some width**, rather than the schema canvas. One line, and
   it decides what the app opens as on a phone. **S**
4. **Reclaim the landscape chrome**: fold the footer counts away and shrink the header, which the
   file-actions menu item already covers. **S**
5. **Only then** consider whether the schema canvas needs anything else in portrait, with the
   answer possibly being "no, and that is fine".

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

**A tooltip for the drag-a-relation hint** — _done by deletion._ Put behind a question mark first,
then removed outright: the palette entries already say what each thing is.

**The rest of the small-screen design** — _stopped deliberately._ The three changes the owner
ordered are in; what the design note suggests beyond them — a bottom sheet in portrait, the
taxonomy as the default tab, reclaiming the landscape chrome — is unbuilt on purpose. See
[Small screens](#small-screens-what-the-app-should-be-on-a-phone).

## How work is ranked

The tool is not trying to be a Swiss army knife. It should do schema editing better than anything
else and stop there, so the ranking question is not "does this add capability?" but **"does this
make the one job more solid, or does it widen the job?"** Solidity first, then the smallest
additions that finish what is already started.

Three rules fall out of that, and they are what produced the order in [Next up](#next-up):

1. **Measure before ranking.** Twice now this changed the answer rather than confirming it. The
   canvas performance worry was retired outright by measuring it, and the index rebuild after it
   — 0.077ms of a 40ms problem — which sent the effort to what was actually costing. Most
   recently, the palette was measured at 36% of a panel it holds three buttons in, which is why
   the subtabs item is parked rather than built.
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

| #   | Now lives in           | As                                                                           | Size |
| --- | ---------------------- | ---------------------------------------------------------------------------- | ---- |
| 3   | Editing workflow       | Palette and taxonomy tree as subtabs — parked, needs a design choice         | M    |
| 9   | Modelling power        | Cap a schema at 7±2 per module                                               | L    |
| 10  | Export and interop     | Folded into the `owl:imports` item; its ranking comes from 29                | L    |
| 11  | Canvas and readability | Draw relation edges in the taxonomy view                                     | M    |
| 18  | Editing workflow       | Metadata editing as an ordinary form, with the vocabulary as plumbing        | M    |
| 20  | Export and interop     | Harden the layout annotation: real tests, and fault tolerance worth the name | S–M  |
| 28  | Editing workflow       | Shrink the inspector on a phone — field layout as much as type               | S    |
| 29  | Editing workflow       | Find an entity by name or description, ranked with BM25                      | M    |
| 30  | Canvas and readability | Let the side panels slide away on desktop — settle against 27 first          | S–M  |

**Done:** 1, 2, 4, 5, 6, 7, 8, 12, 13, 14, 15, 16, 17, 19, 21, 22, 23, 24, 25, 26, 27, 31 — kept as numbers so a commit message naming one can still be resolved.

Anything new still goes here first. Sizing and sequencing it is a separate step, done on request.
