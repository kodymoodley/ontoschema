/**
 * BM25, over a corpus small enough to hold in memory and rebuild on demand.
 *
 * Chosen over counting matches because ranking a schema is mostly about two things that a
 * plain count gets wrong. A word that appears in every description tells you nothing, and BM25
 * discounts it automatically — that is the `idf` term. And a long description should not
 * outrank a short one merely for containing more words, which is what the length
 * normalisation is for: `hasWheel` matching a four-word label beats it matching a hundred-word
 * definition.
 *
 * Written here rather than taken from a package. The whole algorithm is the twenty lines
 * below, the corpus is ours and never leaves the browser, and a search library would arrive
 * with an indexing format, a tokeniser to configure and a persistence story we do not need.
 *
 * Deliberately generic: it knows about documents with fields, not about classes. The schema
 * search uses it, and the vocabulary search will use the same code over a different corpus.
 */

/** One thing that can be found, and the text that should find it. */
export interface SearchDocument<T> {
  id: string;
  /** Weighted text. A name should count for more than a paragraph that mentions the name. */
  fields: { text: string; weight: number }[];
  value: T;
}

export interface SearchHit<T> {
  value: T;
  score: number;
  /** Which field matched best, so the result can show why it is a result. */
  matched: string;
}

/*
 * The usual constants. `k1` decides how fast a repeated word stops adding to the score, and
 * `b` how strongly length is normalised. These are the values BM25 is nearly always used with,
 * and a schema corpus gives no reason to tune them: the documents are short and few.
 */
const K1 = 1.2;
const B = 0.75;

/** Lowercase runs of letters, digits and marks; `hasWheel` becomes `has` and `wheel`. */
export function tokenize(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Ranks documents against a query.
 *
 * Every term must appear somewhere in the document, which is what makes a two-word query
 * narrow the results rather than widen them. Someone typing `car price` means both.
 */
export function search<T>(
  documents: readonly SearchDocument<T>[],
  query: string,
  limit = 20,
): SearchHit<T>[] {
  const terms = tokenize(query);
  if (terms.length === 0 || documents.length === 0) return [];

  const prepared = documents.map((document) => ({
    document,
    fields: document.fields.map((field) => ({ ...field, tokens: tokenize(field.text) })),
  }));

  /*
   * Length is averaged per field, not per document, which matters more than it sounds.
   *
   * Averaged across the whole document, a class called `Venue` with a paragraph of definition
   * is a "long" document, and loses to an attribute called `venueName` with nothing written
   * about it -- both match `venue` in their name, and the one that bothered to explain itself
   * is punished for it. Comparing each field against the average for *that* field asks the
   * right question: is this a short name or a long one, is this a short description or a long
   * one. Which is what BM25F does, and for exactly this reason.
   */
  const fieldCount = Math.max(0, ...prepared.map((entry) => entry.fields.length));
  const averageFieldLength = Array.from({ length: fieldCount }, (_, index) => {
    const lengths = prepared.map((entry) => entry.fields[index]?.tokens.length ?? 0);
    return lengths.reduce((sum, length) => sum + length, 0) / (lengths.length || 1) || 1;
  });

  /** How many documents contain each term, which is what makes a common word cheap. */
  const containing = new Map<string, number>();
  for (const term of terms) {
    containing.set(
      term,
      prepared.filter((d) => d.fields.some((f) => f.tokens.some((t) => t.startsWith(term)))).length,
    );
  }

  const hits: SearchHit<T>[] = [];
  for (const entry of prepared) {
    let score = 0;
    let best = { field: '', contribution: 0 };
    let matchedEveryTerm = true;

    for (const term of terms) {
      const documentsWithTerm = containing.get(term) ?? 0;
      if (documentsWithTerm === 0) {
        matchedEveryTerm = false;
        break;
      }
      /*
       * The `+ 1` keeps the score positive for a term that is in every document. Without it a
       * word everyone shares scores negative, and a document can be pushed below one that does
       * not match at all.
       */
      const idf = Math.log(
        1 + (prepared.length - documentsWithTerm + 0.5) / (documentsWithTerm + 0.5),
      );

      let termScore = 0;
      let termMatched = false;
      for (const [index, field] of entry.fields.entries()) {
        const frequency = field.tokens.filter((token) => token.startsWith(term)).length;
        if (frequency === 0) continue;
        termMatched = true;

        const normalised =
          1 - B + (B * field.tokens.length) / (averageFieldLength[index] ?? field.tokens.length);
        const contribution =
          field.weight * idf * ((frequency * (K1 + 1)) / (frequency + K1 * normalised));
        termScore += contribution;
        if (contribution > best.contribution) best = { field: field.text, contribution };
      }

      if (!termMatched) {
        matchedEveryTerm = false;
        break;
      }
      score += termScore;
    }

    if (matchedEveryTerm && score > 0) {
      hits.push({ value: entry.document.value, score, matched: best.field });
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
