#!/usr/bin/env python3
"""Verify OntoSchema exports with Python rdflib.

The test suite already parses every export with real RDF-JS parsers and asserts that all
four serializations describe the same graph. This script is the independent, second-opinion
check with a different implementation stack, for anyone who has rdflib installed:

    pip install rdflib
    python scripts/verify_exports.py ontology.ttl ontology.rdf ontology.owl ontology.jsonld

It parses each file and reports whether they are isomorphic to one another.
Exits non-zero if any file fails to parse or the graphs disagree.
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from rdflib import Graph
    from rdflib.compare import isomorphic
except ImportError:  # pragma: no cover - guidance only
    sys.exit("rdflib is not installed. Run: pip install rdflib")

FORMAT_BY_SUFFIX = {
    ".ttl": "turtle",
    ".rdf": "xml",
    ".owl": "xml",
    ".jsonld": "json-ld",
    ".json": "json-ld",
}


def load(path: Path) -> Graph:
    fmt = FORMAT_BY_SUFFIX.get(path.suffix.lower())
    if fmt is None:
        raise SystemExit(f"Unrecognised extension: {path}")
    graph = Graph()
    graph.parse(path.as_posix(), format=fmt)
    return graph


def main(argv: list[str]) -> int:
    paths = [Path(arg) for arg in argv[1:]]
    if not paths:
        raise SystemExit(__doc__)

    graphs: list[tuple[Path, Graph]] = []
    for path in paths:
        graph = load(path)
        print(f"OK   {path}  ({len(graph)} triples, parsed as {FORMAT_BY_SUFFIX[path.suffix.lower()]})")
        graphs.append((path, graph))

    reference_path, reference = graphs[0]
    mismatched = [path for path, graph in graphs[1:] if not isomorphic(graph, reference)]

    if mismatched:
        for path in mismatched:
            print(f"FAIL {path} is not isomorphic to {reference_path}", file=sys.stderr)
        return 1

    if len(graphs) > 1:
        print(f"\nAll {len(graphs)} files describe the same graph.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
