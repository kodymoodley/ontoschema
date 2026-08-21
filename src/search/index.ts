/**
 * Ranked search over a small in-memory corpus.
 *
 * Pure and framework-free, like `serialization`: it knows the domain model and nothing above
 * it. The BM25 half is deliberately generic — the schema search uses it now, and the search
 * over an imported vocabulary will use the same code over a different corpus.
 */
export { search, tokenize } from './bm25';
export type { SearchDocument, SearchHit } from './bm25';
export { searchEntities } from './entities';
export type { EntityMatch } from './entities';
