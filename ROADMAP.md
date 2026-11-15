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

**Nothing is sequenced.** The owner's November wishlist is done: todos 38–43, and 46, which grew
out of 40. One filed item waits to be ranked: any datatype as an attribute's range (todo 45).

**Parked by the owner** on 2026-11-02, in favour of the wishlist. None is a commitment until it
appears here again:

- **`owl:imports`, term reuse and read-only imported terms** (todo 10) — the largest new
  dependency surface on the list and the only item that makes this tool depend on vocabularies it
  does not control. It wants a design note before any code; most of that note is already written,
  under [Resolving external vocabularies](#resolving-external-vocabularies).
- **Nine, three times over** (todo 9) — a project rather than an item, decided in principle: nine
  classes to a module, nine modules to a group, nine groups to a file, so 729 classes and the app
  refuses more. A design note comes first and it has five things to answer, listed under
  [Modelling power](#modelling-power).

Why the order is what it is: [How work is ranked](#how-work-is-ranked) at the foot of the file.

---

## Modelling power

Everything here stays inside the TBox, which is the line the project has drawn from the start.

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Size |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Nine, three times over — a limit the app enforces** — **parked to the back of the queue** as a project with subfeatures rather than an item, but decided in principle. Nine classes to a module, nine modules to a module-group, nine module-groups to a schema: **729 classes to a file**, and the app refuses more. The reasoning is a design philosophy rather than a technical limit — past 729 classes in one file you are almost certainly overcomplicating the conceptualisation and should be breaking the system into subsystems anyway, and anyone who disagrees can build several files here and sew them together in Protégé. Modules are drawn the way the taxonomy view already draws them: a box around a group, and **you do not have to see what is inside**. That is the C4 idea — zoom out and the node count falls. Edges are capped by **directed graph density of 0.25**, which is 18 edges for a module of nine. _(todo 9)_ | L    |
| **Any datatype as an attribute's range** — opening a file rewrites a range this app does not offer to `xsd:string`, and the report says so: `rdfs:Literal`, `rdf:langString` (text with a language tag, which this app otherwise cares about) and a vocabulary's own datatypes all narrow or change meaning that way. An attribute's range would become any datatype IRI, with the editor offering the `xsd` list plus whatever the file used, written as `rdfs:range` and as the shape's `sh:datatype`. The model type, the attribute editor, the shapes and saved projects all change, which is why it is its own item rather than part of keeping what an opened file says. _(todo 45)_                                                                                                                                                                                                                                                           | M    |

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

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Size |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **PlantUML diagram export** — the same walk over the model, a second grammar. Worth doing only if Mermaid proves the demand.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | S    |
| **Specify owl:imports for external vocabs from URL** — OntoSchema does not need to load the entire vocabulary into the canvas. Just maintain a cache or memory or localStorage where you load the external ontologies and in the interface all I want is a way to reuse terms that I WANT from those vocabs. I want terms that I don't use to be completely hidden and invisible. But then I would need a way to find or discover terms I need. Perhaps dropdown or search box with BM25 or something like that. **The ranking is already built**: `src/search/` ranks the open schema for todo 29, and its BM25 half knows about documents with weighted fields rather than about classes, so this item brings a corpus to it rather than writing a second one. Be clever and elegant with this in the interface and use your ontology engineering expertise to judge the best method. _Design settled: no proxy, and no fetch on the critical path — see [Resolving external vocabularies](#resolving-external-vocabularies) below._ **Imported terms are read-only**: an axiom or definition that came from PROV-O, PAV or DCAT cannot be edited or redefined here, or the schema quietly disagrees with the vocabulary it claims to import. SKOS is settled: it is not offered as a modelling vocabulary, and its documentation properties stay; see [Which vocabularies ship](#which-vocabularies-ship). _(todo 10)_ | L    |

> **Decided: deferred, not rejected.** A richer SHACL constraint vocabulary — `sh:minCount`,
> `sh:maxCount`, `sh:pattern`, `sh:in`, datatype facets — is real and would be useful, but adding
> it now would dilute focus. This tool should be the best and most efficient **schema editor**
> first: polished, robust, stable, responsive, properly tested. Constraint authoring is a second
> job, and doing both adequately is worse than doing one completely.
>
> Revisit as an explicit choice between a **SHACL submodule** inside OntoSchema and a **separate tool** that consumes the
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

**Keeping the desktop option cheap.** The codebase already has the right pattern:
`projectstore/persistence.ts` is the only file that knows storage exists. If runtime fetching is
ever added, giving it one adapter module of its own means a desktop shell later is a swap of two
small modules, not a rewrite. See [Staying a web app](#staying-a-web-app) under the non-goals.

#### The gap this leaves, and it is a real one

With file upload ruled out, a vocabulary that is neither bundled nor CORS-permitted — an internal
one on a company server, anything on `omg.org` — has **no term browser**. The user can still type
its IRI and it exports correctly; they just get no discovery for it. That is a coherent product
line ("we help you reuse the vocabularies we know about, and you can import anything"), but it is
worth naming rather than discovering later. Widening the bundled set is the lever, and adding to it
is a one-line change to the refresh script.

## Canvas and readability

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Size |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Edge label collision avoidance** — relation lines are routed around the classes, but a label can still sit over another line where two run close together, and two labels can overlap where lines converge.                                                                                                                                                                                                                                              | M    |
| **Subschema filter** — the first thing that bites past about thirty classes, and cheaper than any amount of auto-layout, because hiding is the only thing that scales. Do it before grouping; it may make that unnecessary. Narrow the canvas to a chosen set of classes and relations, or to one class and what it touches, and hide the rest. The answer to a spaghetti diagram that no amount of layout fixes, and the only thing that actually scales. | M    |
| **Grouping in the schema view** — bounding boxes per taxonomy module, as the taxonomy view already does.                                                                                                                                                                                                                                                                                                                                                   | M    |

## Editing workflow

| Item                                                                                                                                                                                                                                                                                                                                     | Size |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Multi-select** — box-select several classes, then move or delete them together.                                                                                                                                                                                                                                                        | M    |
| **Duplicate a class** — with its attributes, as a starting point for a sibling.                                                                                                                                                                                                                                                          | S    |
| **Schema diffing (given two loaded schemas) to compute and generate changelog entries using the Keep a Changelog standard** — governance for a vocabulary that other teams depend on. Sized up from S: it needs two ontologies loaded at once, a structural diff that survives renames, and a mapping from diff to changelog categories. | L    |

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
reaching a GraphDB on the local network. The first now works without a desktop build, in Chrome
and Edge: the File System Access API gives a persistent file handle, and a schema saves itself
into the file it came from (see the README's _Editing a schema file in place_). Firefox and
Safari have declined that API, so for them only a desktop shell would bring it. The other two are
not on the roadmap.

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
thousand attempts. **Nobody found a cause**, so this is not a fix. What was measured and ruled
out is in this file's git history, in case it returns.

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

**A tooltip for the drag-a-relation hint** — _done by deletion._ Put behind a question mark first,
then removed outright: the palette entries already say what each thing is.

**The rest of the small-screen design** — _stopped deliberately._ The three changes the owner
ordered are in: a full-screen button, the header actions folded into one menu, and a narrower
entities drawer. What the design note suggests beyond them — a bottom sheet in portrait, the
taxonomy as the default tab, reclaiming the landscape chrome — is unbuilt on purpose.

**ELK for the shuffle** — _measured, and ruled out on size._ It is the standard layered layout and
came close to d3-dag at untangling the examples (Music: no crossings and no lines through classes for
either; Insurance 12/5 against d3-dag's 7/5), but it is 471 kB gzipped against d3-dag's 31 kB. The
shuffle uses dagre and d3-dag.

**Drawing relation lines above the classes** — _turned down in favour of routing them._ It is the
only setting React Flow offers against a line that disappears behind a class, and it would have
shown the crossing rather than removed it, running the line over the class's name and attributes.
Lines are routed around classes with libavoid instead. MSAGL's router (MIT, 137 kB, no
incremental re-routing), `obstacle-router` (an LGPL port of libavoid at version 0.1) and
`react-flow-smart-edge` (each line routed alone on a grid, so lines pile onto each other) were
looked at and not taken.

**Hardening the old layout reader, and opening a repository as a folder** — _dropped by the owner
on 2026-11-15, not parked._ The first (todo 20) would have tested the reader kept for files saved
with every position in one `ontoschema:layout` literal against hostile input. The second, todo
44, would have opened a cloned repository as a folder and `.ttl` files from the desktop. Neither
is to be picked up again.

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
| 45  | Modelling power    | Any datatype as an attribute's range                                | M    |

**Done:** 1, 2, 4, 5, 6, 7, 8, 12, 13, 14, 15, 16, 17, 19, 21, 22, 23, 24, 25, 26, 11, 27, 29, 30, 31, 32, 33, 34, 28, 35, 18, 36, 37, 42, 43, 39, 41, 38, 40, 46 — kept as numbers so a commit message naming one can still be resolved. **Dropped:** 20, 44; see
[Decided against](#decided-against-and-why).

Anything new still goes here first. Sizing and sequencing it is a separate step, done on request.
