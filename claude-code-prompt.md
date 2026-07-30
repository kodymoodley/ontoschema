# Task: Build "OntoSchema" — a lightweight visual ontology schema builder (MVP)

## Process — read first

Before writing any code, present a short implementation plan for approval. It must state: the stack you propose, every library you intend to use and the specific job each one does, the directory layout, and your testing approach. Wait for my approval, then build the complete MVP in one pass — this is not a phased delivery. I need a running, polished, tested starting point that covers the entire core workflow end to end. Advanced features will be added later in separate, incremental steps.

## Product goal

A lightweight, modern, visually polished web tool for building **schema-level ontologies** (TBox only) in a graphical way, on a drag-and-drop canvas, and exporting them to standard RDF serializations.

## Scope

**In scope:**

- Classes, object properties, and datatype properties, arranged in taxonomies (subclass / subproperty hierarchies).
- Rich annotations on every class and property, using well-known annotation vocabularies: `rdfs:label`, `rdfs:comment`, `owl` annotation terms, `dcterms` (e.g. creator, created, description), `skos` (e.g. prefLabel, altLabel, definition, note), and `prov-o` where relevant. Support language tags (e.g. `@en`, `@nl`) on text annotations.
- Export to Turtle (`.ttl`), RDF/XML (`.rdf` and `.owl` — same serialization, both file extensions offered), and JSON-LD (`.jsonld`; it is simply another standard RDF serialization, so include it).
- Saving and loading projects (schema diagrams)

**Out of scope (do not build):**

- Instance data / individuals (ABox).
- Advanced OWL axioms: restrictions, unions/intersections, cardinalities, property chains, reasoning of any kind.
- Import/round-tripping of existing ontologies, persistence backends, auth, collaboration. (Keep the architecture open to these, but do not implement them now.)

## Core user workflow (all of this must work in the MVP)

1. **Create classes**: drag a class shape (box or similar) from a palette onto the canvas; name it; edit its IRI local name and annotations in a side panel.
2. **Add datatype properties (attributes) to a class**: same drag and drop a green rectangle from a palette onto canvas and then enter value e.g. for class `Car`, one could add `make`, `model`, `year`, `engine`, `price` — each with an `xsd` range chosen from a sensible list (string, integer, decimal, date, dateTime, boolean, anyURI). Attributes display inside/attached to the class shape.
3. **Create object properties (relations)**: I want to clearly draw a distinction between two subtypes of object properties in the interface and interaction. One type is for specifying domain and range constraints in the schema. The user should be able to create it by connecting two class shapes by dragging an edge (or click-source-then-target); name the relation, e.g. `Car —offeredBy→ Dealership`. The edge direction defines `rdfs:domain` and `rdfs:range`. The second type of object property is one which is generic (can be used between multiple different classes of entity) e.g. hasPart, isAssociatedWith, isRelatedTo etc. they should be created in a different way in the interface. I am open to suggestions but my default recommendation to be consistent with classes and datatype properties I think dragging and dropping a different type of rectangle from the palette onto the canvas.
4. **Build taxonomies**: Protege or TopQuadrant style class hierarchy or taxonomy tree section or tab or something where we can add, delete, and edit class descriptions. Same for object properties. Not for datatype properties. Mark subclass relationships between classes (visually distinct from object properties) and optionally subproperty relationships. Keep in mind we have to think of a clever way to visualise the subclass / superclass relationships to be meaningful and visually distinct from other relations. Because I want to add feature to export a diagram of the schema to mermaid or plantUML later. I am leaning to a clean and neat way to render the subclass relationships in a tree style hierarchy with the root node at the top center of screen and the leaves at the bottom. And for diagram readability and scalability thereof I expect we might have to group (e.g., make bounding boxes around) or make modular subparts of the graph (e.g., by different root nodes in the class hierarchy). Make clever suggestions on ways to make this look elegant and clean. I don't want spaghetti graphs.
5. **Annotate everything**: a properties/annotations panel for the selected class or property covering the vocabularies listed above.
6. **Set ontology metadata**: base IRI, prefix, ontology-level annotations (title, description, creator, version).
7. **Export**: one-click export/download of the current ontology as `.ttl`, `.rdf`, `.owl`, `.jsonld` — all serializations semantically identical, valid, and openable in standard tools (Protégé, rdflib).
8. **Manage multiple ontologies**: be able to start new ontology projects (new project / ontology) feature and switch and load between them.

## Non-functional requirements

- **Lightweight**: minimal dependency footprint; every dependency must earn its place. Prefer a small set of well-maintained libraries over a kitchen sink.
- **Modern and polished from the start**: clean typography, sensible spacing, considered color palette, smooth canvas interactions (pan, zoom, select, delete, undo/redo if cheap to include). It should look like a designed product, not a wireframe — but do not gold-plate features.
- **Client-side only** unless you can justify otherwise in the plan: no backend should be needed for this scope.

## Architecture and code quality (highest priority)

- Clean code with **separation of concerns and modularity as the core design principle**.
- **Domain-driven directory naming**: name modules/subdirectories after the domain function they perform — e.g. `classeditor/`, `relationeditor/`, `annotationpanel/`, `canvas/`, `ontologymodel/`, `serialization/` — **not** framework-generic names like `components/`, `views/`, `utils/`, `helpers/`.
- **Minimize cross-module references**: each module should be as self-contained as possible; cross-module imports kept to an absolute minimum and flowing through a small, explicit domain model layer (the single source of truth for ontology state). The serialization layer must depend only on the domain model, never on UI code.
- The domain model (classes, properties, annotations) must be pure and framework-agnostic, so serializers and future features can be tested without any UI.

## Testing (build alongside the code, not after)

- **Unit tests** for the domain model and every serializer (round-trip/validity checks on generated Turtle, RDF/XML, JSON-LD).
- **Integration tests** for module boundaries (e.g. editing state → model → serialization).
- **End-to-end tests with Playwright** simulating realistic user workflows — e.g. "create Car and Dealership, add five attributes to Car, connect them with offeredBy, annotate with skos:prefLabel in two languages, export as .ttl, assert the downloaded file contains the expected triples."
- Tests must simulate realistic user behavior and realistic data, not trivial happy paths only (include: renaming, deleting a class that has relations, invalid IRI characters, empty ontology export).
- **Mock judiciously**: do not mock what can run for real. Serializers, the domain model, and browser interactions in Playwright run unmocked; mocking is acceptable only for true externalities (e.g. file-download plumbing where the test runner requires it).

## DevOps and repo hygiene

- Set up standard workflows: build, format, lint, typecheck, and test (all three tiers), runnable locally via package scripts and in CI (provide the CI workflow file).
- Pre-commit hooks running format + lint + affected unit tests.
- Sensible defaults only — common best-practice configs, nothing exotic.

## Deliverables

1. The running MVP application (with a one-command dev setup, e.g. `npm install && npm run dev`).
2. Full test suites (unit, integration, Playwright e2e) — all passing.
3. CI workflow + pre-commit configuration.
4. A **README** containing: a one-paragraph product description; setup/run/test instructions; and a clear table listing **every library and framework used, mapped to the specific function/component it serves in the app**; plus a short architecture section explaining the module layout and the dependency rules between modules.

## Acceptance check (verify before declaring done)

- The full Car/Dealership workflow above can be performed in the UI without errors.
- All four export formats download and parse cleanly in rdflib.
- All tests pass; lint/format/typecheck are clean; pre-commit hooks fire.
- No framework-generic directory names; no module imports that bypass the domain model layer.
