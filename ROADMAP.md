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

**Both side panels now fold away on a wide screen** (todo 30), with two follow-ups that came
out of using it. Selecting an entity unfolds the inspector again (todo 33) — the rule from todo
27, that selecting is what opens it, had to keep holding once there was a folded state for it to
hold against. And one control puts both panels away and frames the whole schema at
once, and puts them back again (todo 34), because the two halves of "show me everything" are
worth having on one button.

**The inspector arc is finished too** — todos 23 to 29. The tab strip is gone: export left, then
the schema's own metadata, then Details and Annotations became one scrolling panel. There is no
Inspector toggle any more, because selecting something is what opens it, at every width. And a
schema too big to scan can be searched by name or description from `Ctrl`+`K`.

What that leaves is short. Neither of the two sequenced items is ready to start, and saying so is
the point of listing them: both want a design note before any code.

1. **`owl:imports`, term reuse and read-only imported terms** — last by decision rather than by
   size. It is the largest new dependency surface on the list, and the only item that makes this
   tool depend on vocabularies it does not control; everything above it improves what is already
   here.

**Filed, and deliberately not sequenced.** None of these is a commitment until it appears in the
list above:

- **Harden the layout annotation** (todo 20) — **parked to the back of the queue** by the owner.
  Still owed work rather than wanted work: the positions shipped with the happy path tested and
  little else. Nothing depends on it, which is why it can wait — it does not stop being owed by
  waiting, and the entry lists exactly what is untested so the debt stays legible.
- **Metadata editing as an ordinary form** (todo 18) — scoped now: the ontology's metadata and an
  entity's details and annotations, and nowhere else. Export keeps its jargon, because the RDF is
  what that panel is for. Waits on a proposal rather than a slot — what the forms hold, in what
  order, under what labels — which the owner approves before any of it is built.
- **Palette and taxonomy as subtabs** (todo 3) — parked after measuring; the choice of shape is
  the owner's.
- **Nine, three times over** (todo 9) — parked as a project rather than an item, and decided in
  principle: nine classes to a module, nine modules to a group, nine groups to a file, so 729
  classes and the app refuses more. Modules are boxes you need not see inside, as C4 does it.
  A design note comes first, and the note has five things to answer — they are listed under
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

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Size |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Nine, three times over — a limit the app enforces** — **parked to the back of the queue** as a project with subfeatures rather than an item, but decided in principle. Nine classes to a module, nine modules to a module-group, nine module-groups to a schema: **729 classes to a file**, and the app refuses more. The reasoning is a design philosophy rather than a technical limit — past 729 classes in one file you are almost certainly overcomplicating the conceptualisation and should be breaking the system into subsystems anyway, and anyone who disagrees can build several files here and sew them together in Protégé. Modules are drawn the way the taxonomy view already draws them: a box around a group, and **you do not have to see what is inside**. That is the C4 idea — zoom out and the node count falls. Edges are capped by **directed graph density of 0.25**, which is 18 edges for a module of nine. _(todo 9)_ | L    |

## Export and interop

<!-- prettier-ignore -->
> **A saved file carries its shapes** (todo 36), decided by the owner after reading an exported
> file and asking why it was full of `rdf:first`. It answers two complaints at once.
>
> The first is correctness, and it was worse than the untidiness that surfaced it. `rdfs:domain`
> and `rdfs:range` name both ends of a relation but not which end went with which, so a relation
> drawn between two pairs was saved as a union and read back as all four: saving the insurance
> example and opening it returned `MotorPolicy insures Dwelling` and `HomePolicy insures Vehicle`,
> which nobody had drawn. Measured, 2 usages became 4. The panel promising a round trip was
> promising something the format could not do.
>
> The second is the untidiness. With the shapes in the file the union has nothing left to do, so
> it is not written — and with it go every blank node and every `rdf:first` cell. The insurance
> export now has none of either.
>
> **Each end is judged on its own.** A relation drawn from one class to three still states its
> domain, because that end is exact; only the end that would have to be approximated is left to
> the shapes. And a document written *without* shapes — a foreign file, or anything asking for
> axioms alone — still gets the union, because then it is the best that file can do.
>
> The cost is size: the insurance schema went from 10.2 kB to 21.5 kB, roughly double. Reading is
> unaffected — shapes are preferred when present, the ends are the fallback — so files saved by
> earlier versions open exactly as they did, cross product and all.

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Size |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **A quality and audit pass over the whole app** — not a feature: a read of everything with fresh eyes, looking for what accumulates in a codebase nobody has audited end to end. The kind that started this: **prose that no longer matches behaviour**, where two inspector panels claimed `rdfs:domain` was omitted for a reused property while the exporter had been stating a union since the commit that changed it, and nothing failed because nothing tied the words to the behaviour. Also worth sweeping for: **comments and doc blocks that describe an older design**; **tests that pin a wrong claim** and so protect it; **tests that cannot fail**, of which this project has already found several; **dead code and unused exports** left by items that changed shape mid-build; **duplicated logic** that drifted apart; **error paths never exercised**; **inconsistencies between the three writers** and between what each panel says and what it does. It should produce a written list with a severity on each item, not a pile of commits — what to fix is a separate decision. _(todo 37)_                                                                                                                                                                                                                                                                                     | M    |
| **PlantUML diagram export** — the same walk over the model, a second grammar. Worth doing only if Mermaid proves the demand.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | S    |
| **Harden the layout annotation** — _parked to the back of the queue._ The positions half of todo 17 shipped with tests that cover the happy path and five malformed strings, which is not the same as being robust. What is actually untested: **scale** — a few hundred classes put a single literal of tens of kilobytes on one line, and nothing checks what that does to the writers, to the file, or to the time it takes; **the decoder against real hostility** — `__proto__` and `constructor` as keys, coordinates that are `NaN`, `Infinity`, `1e308` or a string that parses as a number, an entry whose key is not an IRI at all, a value nested arbitrarily deep; **partial recovery** — a layout naming three classes that no longer exist and omitting two that do, which is the ordinary case after editing a file elsewhere and the one the decoder has never been asked about; **the round trip end to end**, which cannot be finished until the importer exists, so the decoder is dead code the suite exercises only in isolation. Also **not mutation-tested**: Stryker is pointed at `src/serialization/` alone, so `layout.ts` has no measured test strength at all, and the obvious mutants — dropping the rounding, dropping the sort, inverting a guard — would very likely survive. Widen the mutation scope to cover it and hold it to the same bar. _(todo 20)_          | S–M  |
| **Specify owl:imports for external vocabs from URL** — OntoSchema does not need to load the entire vocabulary into the canvas. Just maintain a cache or memory or localStorage where you load the external ontologies and in the interface all I want is a way to reuse terms that I WANT from those vocabs. I want terms that I don't use to be completely hidden and invisible. But then I would need a way to find or discover terms I need. Perhaps dropdown or search box with BM25 or something like that. **The ranking is already built**: `src/search/` ranks the open schema for todo 29, and its BM25 half knows about documents with weighted fields rather than about classes, so this item brings a corpus to it rather than writing a second one. Be clever and elegant with this in the interface and use your ontology engineering expertise to judge the best method. _Design settled: no proxy, and no fetch on the critical path — see [Resolving external vocabularies](#resolving-external-vocabularies) below._ **Imported terms are read-only**: an axiom or definition that came from PROV-O, PAV or DCAT cannot be edited or redefined here, or the schema quietly disagrees with the vocabulary it claims to import. Note the tension to settle first — SKOS appears on the todo list as something to import, and is excluded above as a modelling vocabulary. _(todo 10)_ | L    |

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

<!-- prettier-ignore -->
> **Relations in the schema view are drawn rigid** (todo 32), and it cost far less than the entry
> feared because the entry had the wrong plan in it. Copying the taxonomy's lane routing would
> have meant re-finding the lanes on every frame of a drag. It was not needed: `chooseSides`
> already picks the pair of sides two classes face each other across, so stepping between those
> two points is all a right-angled line here is. The subclass links beside them had been drawn
> that way from the start, with the same generator and the same corner radius, so the change was
> to stop being the odd one out. What lanes would still buy is a line that avoids the classes in
> between, which is what **edge label collision avoidance** below is really about.

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Size |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Edge label collision avoidance** — a relation's label can park on top of an unrelated class. Straight edges between aligned classes pass over whatever is between them; the label makes it obvious.                                                                                                                                                                                                                                                                                                                                                                             | M    |
| **Tidy-up / auto-layout for the schema view** — the taxonomy view lays itself out with dagre; the schema view never does. A button, not automatic.                                                                                                                                                                                                                                                                                                                                                                                                                                | M    |
| **Subschema filter** — the first thing that bites past about thirty classes, and cheaper than any amount of auto-layout, because hiding is the only thing that scales. Do it before the layout and grouping items below; it may make them unnecessary. Narrow the canvas to a chosen set of classes and relations, or to one class and what it touches, and hide the rest. The answer to a spaghetti diagram that no amount of layout fixes, and the only thing that actually scales. _Was listed twice: also appeared under Editing workflow as "filter schema for subschemas"._ | M    |
| **Grouping in the schema view** — bounding boxes per taxonomy module, as the taxonomy view already does.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | M    |

## Editing workflow

<!-- prettier-ignore -->
> **Metadata as an ordinary form** (todo 18) is built, to a proposal the owner approved before any
> code. The shape is three layers, on the schema's own metadata and on an entity alike: a handful
> of labelled boxes in plain words; a **Show RDF terms** switch, off by default, that names the
> term each box writes; and **Other properties**, closed, holding the whole vocabulary exactly as
> it was.
>
> The decisions taken with it, since they are the parts a later reader would otherwise have to
> guess at:
>
> - **Repeats.** A named field edits the *first* annotation with its term. A second value of a
>   promoted term — a second `skos:example` — appears under Other properties, which is where
>   lists belong. The alternative, every field growing an "add another", was most of the weight
>   the item existed to remove.
> - **Which terms are promoted.** For a schema: title, description, author, version, licence. For
>   an entity: label, definition, comment, example, and deprecated as a switch rather than a text
>   field you type `true` into.
> - **A term with a box is not offered in the list** until it is already in use, because adding it
>   while unused would create a row that vanished as it appeared — the box above would claim it.
> - **An empty box is not an annotation.** Typing into an empty field creates one; emptying a
>   field removes it, rather than exporting `dcterms:title ""`, which claims the title is the
>   empty string.
> - **Datatypes lost their prefix** and nothing else: `string`, `integer`, `boolean`. Applied
>   everywhere they are shown, not only in the inspector — the same value spelled two ways in two
>   places is worse than either spelling.
>
> Not touched, deliberately: saving and exporting keep their format names and their preview, and
> the namespace and prefix fields keep theirs. Jargon stays where it is the subject.

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Size |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Multi-select** — box-select several classes, then move or delete them together.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | M    |
| **Duplicate a class** — with its attributes, as a starting point for a sibling.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | S    |
| **Schema diffing (given two loaded schemas) to compute and generate changelog entries using the Keep a Changelog standard** — governance for a vocabulary that other teams depend on. Sized up from S: it needs two ontologies loaded at once, a structural diff that survives renames, and a mapping from diff to changelog categories.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | L    |
| **Make the palette and the taxonomy tree subtabs of the left panel** — they are stacked today, so both are cramped and neither is whole. **Parked on 20 August 2026**, with two things measured that the entry did not know. The palette costs **304px of an 852px panel** at 1440×900 — 36% — to hold three buttons, and the size is the hint sentence under each one, not the buttons. And the tree already has a tab strip of its own (Class, Relation, Attribute), so _subtabs_ means a second strip above it: 60px of tabs in a panel whose complaint is wasted height. Three ways out were drawn up — shrink the palette to one row and add no tabs at all, fold it in as a fourth tab beside the three entity tabs, or nest the strips as filed — and choosing between them is the owner's call, not a detail of the build. _(todo 3)_ | M    |

<!-- prettier-ignore -->
> **Todos 25, 26 and 27 are one arc, in that order.** Each is shippable on its own, but together
> they retire the inspector's tab strip: _Export_ has already left, _Metadata_ leaves under 25,
> _Details_ and _Annotations_ become one panel under 26, and 27 then removes the toggle that only
> existed to reveal a panel with nothing in it. Done piecemeal in another order, 27 would strand
> the metadata tab behind a control that no longer opens.

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

### What measuring the inspector at 320px found

Todo 28 is done, and the entry's own diagnosis was wrong in an instructive way. It said the type
scale was already handled and the problem was labels beside their fields. Measured, the fields
were fine — **the panel was laying itself out 48px wider than the pane it lives in**, and the
cause was that a row could not shrink. The name in an attribute row is a button; a button does
not shrink below its longest word; a column flex container is as wide as its widest child. So
`durationSeconds` made the whole inspector 203px against a 159px drawer and pushed the remove
button of every row out through the right-hand edge.

What fixed it: rows wrap at drawer widths so a name keeps its own line, the name may also trail
off for names longer than the panel, the add-an-attribute row stacks instead of fitting a text
field, a 116px select and a button onto one line, the relation pairing reads down rather than
across, and the panel's title wraps under its badge instead of showing `performe…`.

The type scale was never touched, which is the part worth remembering: the entry named a cause
before anyone measured, and the named cause was not the one.

### What the drawers were covering

Todo 35, found while measuring todo 28 and fixed straight after it. The side panels open as
overlay drawers below 1024px, and they opened below the _header_ — which put them over the canvas
toolbar. Measured at 320×640 with a class selected, by hit-testing rather than by eye: Undo, Redo,
Find and the hide-both-panels control were all covered, and only the two view tabs answered a tap.
Selecting is how you edit, so undo was unreachable exactly while it was wanted.

They now open below the toolbar, whose height the shell measures rather than assumes. The strip is
content-sized — a different set of controls per view, a type scale that steps down at this width,
and it wraps if it must — so a constant would have been right until the first of those changed and
quietly wrong after.

The same measurement turned up a second thing, and it is the reason a control's _state_ is worth
testing separately from its effect: the hide-both-panels button changed its own label on a phone
and left the drawer sitting where it was. The inspector is a drawer at that width rather than a
column and it opened on selection alone, with nothing consulting the fold. Both panels now go away
and come back on a phone exactly as they do on a desktop.

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

**Subclass links on the schema canvas** — _removed, by the owner._ They were drawn there as well
as in the taxonomy view so the two views could not disagree about what the model holds. In
practice they were a second set of lines through the same crowded middle, saying what each class
box already says in its own header, and the taxonomy view shows a hierarchy far better because it
lays one out rather than drawing it over wherever the classes were dragged. The schema canvas now
draws relations only. Nothing changed in the model or in any export.

**The taxonomy view's caption** — _done by deletion._ "Laid out automatically — one module per
root class, superclasses above" described a picture that explains itself, in a toolbar where
every other character is a control. Its removal also settled a smaller complaint: prose that comes
and goes was moving the relation switch beside it, so the switch now sits ahead of the hint and
nothing the hint does can shift it.

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

| #   | Now lives in       | As                                                                         | Size |
| --- | ------------------ | -------------------------------------------------------------------------- | ---- |
| 3   | Editing workflow   | Palette and taxonomy tree as subtabs — parked, needs a design choice       | M    |
| 9   | Modelling power    | Nine, three times over — 729 classes, enforced; parked as a project        | L    |
| 10  | Export and interop | Folded into the `owl:imports` item; its ranking comes from 29              | L    |
| 18  | Editing workflow   | Metadata editing as an ordinary form, with the vocabulary as plumbing      | M    |
| 20  | Export and interop | Harden the layout annotation — parked to the back of the queue             | S–M  |
| 37  | Export and interop | A quality and audit pass over the whole app — produces a list, not commits | M    |
| 28  | Editing workflow   | Shrink the inspector on a phone — field layout as much as type             | S    |

**Done:** 1, 2, 4, 5, 6, 7, 8, 12, 13, 14, 15, 16, 17, 19, 21, 22, 23, 24, 25, 26, 11, 27, 29, 30, 31, 32, 33, 34, 28, 35, 18, 36 — kept as numbers so a commit message naming one can still be resolved.

Anything new still goes here first. Sizing and sequencing it is a separate step, done on request.
