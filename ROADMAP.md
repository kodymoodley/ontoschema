# OntoSchema — roadmap

Where the project is going. One line per item: what it is, why it is worth doing, and roughly
how big it is (**S** a sitting, **M** a day or two, **L** a project in its own right).

Anything already built is described in the [README](README.md); this file is only about what is
not. Items are grouped by theme, not by order — the running order lives in **Next up** below and
is the only part that claims to be a commitment.

---

## Next up

1. SHACL constraint vocabulary — **pending a decision**, see the flagged note under _Export and interop_
2. Multiple superclasses through the UI
3. `owl:imports` and selective term reuse

The reasoning is in [Proposed running order](#proposed-running-order) at the foot of the file.

---

## Modelling power

Everything here stays inside the TBox, which is the line the project has drawn from the start.

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Size |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Multiple superclasses in hierarchy and canvas** — _verified: the model allows it, the UI does not._ `OntologyClass.superClassIds` is a list, `addSubClassOf` appends, and the class node already renders `⊂ Vehicle, Asset`. But every UI path goes through `setSuperClass`, which **replaces** — both the inspector's single `<select>` and the hierarchy tree's drag-to-reparent. Needs a multi-value control in the inspector and an add-a-parent gesture in the tree distinct from move-a-parent. | M    |

## Export and interop

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Size |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Mermaid / PlantUML diagram export** — asked for in the original brief and still not built. The subclass edge already draws the hollow triangle these use, so the visual vocabulary matches. I love the neatness of the taxonomy diagram tab but no non-subclass edges are there which could be the reason they look so neat.                                                                                                                                                                                                                                                                                                          | M    |
| **Specify owl:imports for external vocabs from URL** — OntoSchema does not need to load the entire vocabulary into the canvas. Just maintain a cache or memory or localStorage where you load the external ontologies and in the interface all I want is a way to reuse terms that I WANT from those vocabs. I want terms that I don't use to be completely hidden and invisible. But then I would need a way to find or discover terms I need. Perhaps dropdown or search box with BM25 or something like that. Be clever and elegant with this in the interface and use your ontology engineering expertise to judge the best method. | L    |
| ~~**SHACL conversion and export**~~ — _already built._ Every usage becomes a named `sh:PropertyShape`, several targets on one path become a single `sh:or`, and the Export panel can switch the OWL/RDFS axioms off. Unticking axioms and downloading `.ttl` already gives a shapes-only Turtle file. See [Two export layers](README.md#two-export-layers). What is missing is not the export but the **vocabulary of constraints** — see the note below.                                                                                                                                                                               | —    |

> **Flagged for your call.** The shapes we emit today say only _which class_ sits at the end of a
> path. They cannot say `sh:minCount 1`, `sh:maxCount 1`, `sh:pattern`, `sh:in` or a datatype
> facet — so a validator can check that a `Policy`'s `policyholder` is a `Person`, but not that it
> has exactly one, nor that a `claimStatus` is one of four permitted values. For a pipeline whose
> point is SHACL validation in GraphDB, and for modelling insurance inclusion and exclusion
> criteria, that is a large gap.
>
> These constraints were dropped from the roadmap alongside the OWL items, but they are not OWL:
> **SHACL is a validation vocabulary, not a logic**, and none of `sh:minCount`, `sh:in` or
> `sh:pattern` implies any reasoning. They fit the stated intent squarely and do not cross the
> "not a full OWL editor" line. Proposed as an **M**: a small number field and a values list in the
> inspector, plus one clause in each of the three writers. Say the word and it goes in.

## Canvas and readability

| Item                                                                                                                                                                                                  | Size |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Edge label collision avoidance** — a relation's label can park on top of an unrelated class. Straight edges between aligned classes pass over whatever is between them; the label makes it obvious. | M    |
| **Tidy-up / auto-layout for the schema view** — the taxonomy view lays itself out with dagre; the schema view never does. A button, not automatic.                                                    | M    |
| **Find and jump to an entity** — a search box or `Ctrl`+`K`. Already wanted at fifteen classes, which the examples reach.                                                                             | S    |
| **Neighbourhood filter** — show one class and what it touches, hide the rest. The answer to a spaghetti diagram that no amount of layout fixes.                                                       | M    |
| **Grouping in the schema view** — bounding boxes per taxonomy module, as the taxonomy view already does.                                                                                              | M    |
| **Stepped / orthogonal edges as an option** — now that each edge picks a side, right-angled routing is a small step and reads better for dense schemas.                                               | S    |

## Editing workflow

| Item                                                                                                                                                                                                           | Size |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Multi-select** — box-select several classes, then move or delete them together.                                                                                                                              | M    |
| **Duplicate a class** — with its attributes, as a starting point for a sibling.                                                                                                                                | S    |
| **Filter schema for subschemas based on specified classes and relations involved** — helps deal with larger schemas to make them more manageable and navigatable.                                              | S    |
| **Schema diffing feature (given two loaded schemas) to compute and generate changelog entries using keep a changelog standard** — helps deal with larger schemas to make them more manageable and navigatable. | S    |

## Housekeeping

| Item                                                                                                                                     | Size |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **Export and import a whole workspace** — save/open works per project; there is no way to move all of them between machines in one file. | S    |
| **Undo across a project switch** — history is per session, and switching projects loses it silently.                                     | S    |
| **Cross-tab safety** — two tabs on the same workspace both write `localStorage` and the last one wins.                                   | M    |

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

Statement about apps intent and scope so you can know what features to suggest and what are out of scope and not keeping with the intent and vision: this app is a linked data engineering workflow for building semantic layers for applications in a business context such as: legal compliance checking, RAGs for explainable chatbot responses, building validation, interoperability and provenance infrastructure for heterogeneous data in finance, insurance and pension firms. Often the common pattern is we need to build a lightweight terminology that we use to convert data from Excel, CSV, SQL etc. into RDF triples put them in graphdb with SHACL constraints, and we want to do SHACL validation to verify which data is acceptable or not. Or we want to harmonise data across departments and formats. Or we want to model exclusion and inclusion criteria for insurance coverage rules buried in free text PDF documents in some sort of way that using linked or semantic web technologies. I noticed a gap that ontology editors are either proprietary or very dated, or overly feature-packed with steep learning curve, I wanted a lightweight schema editor to build RDF/OWL vocabularies and schemas which can be used in semantic data engineering workflows.

---

## Proposed running order

Read off the intent above rather than off effort alone. If the point of the tool is to produce a
terminology that a pipeline converts data against and a validator then checks, then the ranking
question for every item is: **does the artefact we export get more useful, or does the editor get
more pleasant?** The first kind goes first.

1. **SHACL constraint vocabulary** (M) — _pending your call above._ Everything else on this list
   improves how a schema is made; this is the only item that changes what the schema can _do_ once
   it leaves the app. A shape that cannot express "exactly one policyholder" or "status is one of
   these four" will not carry a compliance rule, and compliance rules are the stated use case.
2. **Multiple superclasses through the UI** (M) — a real modelling limitation, not a nice-to-have.
   Business vocabularies are full of classes that are two things at once — a `LeaseAgreement` is a
   `Contract` and a `FinancialInstrument` — and today the interface silently replaces one parent
   with the other. The model and the exporters already handle it, so this is UI work only.
3. **`owl:imports` and selective term reuse** (L) — the interoperability item. Harmonising across
   departments and formats means agreeing on terms, and agreement means reusing `dcterms`, `skos`,
   `schema.org`, FIBO rather than minting a private IRI for `name` for the fourth time. This is the
   biggest single step from "a vocabulary" to "a vocabulary that fits somewhere", and it is worth
   doing after 1 and 2 so that imported terms arrive into a model that can already constrain them.
4. **Subschema filter / neighbourhood view** (M, not S) — the first thing that bites when a real
   schema passes about thirty classes, which the insurance and finance cases will. Cheaper and more
   effective than any amount of auto-layout: hiding is the only thing that actually scales.
5. **Mermaid / PlantUML export** (M) — outstanding from the original brief, and the cheapest route
   from a schema to a document or a pull request. Worth noting the observation in the table above:
   the taxonomy tab looks clean precisely because it draws one edge kind. A Mermaid class diagram
   has the same property, so this export will flatter the schema in a way the canvas cannot.
6. **Schema diffing and changelog** (M/L, not S) — governance, and it only pays once vocabularies
   are versioned and in use, which is downstream of everything above. Sized up because it needs two
   ontologies loaded at once, a structural diff that survives renames, and a mapping from diff to
   Keep a Changelog categories. Worth its own design pass.
7. **Canvas readability and housekeeping** — edge label collision, tidy-up layout, find-and-jump,
   orthogonal edges, workspace export, undo across a project switch, cross-tab safety. Individually
   small, none of them blocking. Good filler between the larger items above, and good candidates
   whenever one of those is waiting on a decision.

Two sizing disagreements are folded in above: subschema filtering and schema diffing are both
marked **S** in the tables and are, on reflection, not.
