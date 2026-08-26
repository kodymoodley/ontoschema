/**
 * Separating the edges that meet a class at the same place.
 *
 * A relation is a directed edge and reads as one, right up until a second relation meets the
 * same box on the same side. A class node has one handle per side, so every edge arriving at or
 * leaving from that side attaches at the identical point: one edge's arrowhead lands exactly on
 * another's tail, and the two together read as a single line with a head at each end — a picture
 * of a symmetric relationship, which is the opposite of what the model holds.
 *
 * It is not a rare arrangement. Inverse pairs are how most published vocabularies are written —
 * `assesses` and `isAssessedBy`, `hasMetric` and `isMetricOf` — and each one puts two relations
 * between the same two classes pointing opposite ways. But they are not the only case, which is
 * what makes the **side** the right thing to group on rather than the pair of classes: in the
 * Building Assessment Ontology, `hasPart` arrives at Part's top while `hasCredit` leaves from
 * it, and those two have no pair in common at all. Grouping by pair left nine such collisions
 * standing; grouping by side leaves none.
 *
 * The fix is the ordinary one from graph drawing: give each endpoint at a side its own lane and
 * fan them along it. Lanes are numbered from the middle, so a pair straddles the centre and an
 * odd bundle keeps one endpoint exactly where a lone one would have been.
 */

/** How far apart neighbouring lanes sit, measured along the side of the box. */
export const LANE_SPREAD = 13;

/**
 * The most a bundle may spread either way from the centre of a side.
 *
 * A class box is 224 wide and often under 120 tall, so an unbounded fan would walk endpoints off
 * the end of the side they attach to. Past this, lanes pack closer instead of spreading further:
 * eight relations meeting one side of one class is a diagram that needs the subschema filter,
 * not one that needs more pixels.
 */
const MAX_OFFSET = 26;

export interface Endpoint {
  /** Identifies this end of this edge. Each edge contributes two. */
  key: string;
  /**
   * Which side of which box it attaches to. Endpoints sharing this string are the ones that
   * would otherwise land on the same pixel.
   */
  at: string;
}

/**
 * How far each endpoint should be shifted from the middle of its side, in pixels along that
 * side.
 *
 * Zero for an endpoint with its side to itself, which is the common case and has to stay exactly
 * where it was: a fix for crowded diagrams that quietly nudges every uncrowded one is not a fix.
 *
 * Order within a bundle is by `key`, which makes the arrangement deterministic — the same schema
 * always draws the same way, and an edit somewhere else does not shuffle lines that had nothing
 * to do with it.
 */
export function endpointOffsets(endpoints: readonly Endpoint[]): Map<string, number> {
  const sides = new Map<string, string[]>();
  for (const endpoint of endpoints) {
    const found = sides.get(endpoint.at);
    if (found) found.push(endpoint.key);
    else sides.set(endpoint.at, [endpoint.key]);
  }

  const offsets = new Map<string, number>();
  for (const members of sides.values()) {
    if (members.length < 2) {
      const only = members[0];
      if (only !== undefined) offsets.set(only, 0);
      continue;
    }

    // Lanes run -(n-1)/2 .. +(n-1)/2, so two endpoints sit either side of where one would have.
    const half = (members.length - 1) / 2;
    const spread = Math.min(LANE_SPREAD, MAX_OFFSET / half);
    [...members]
      .sort()
      .forEach((key, index) => offsets.set(key, Number(((index - half) * spread).toFixed(3))));
  }
  return offsets;
}

/** The two halves of an edge's identity, so a caller and this module cannot disagree on them. */
export const sourceEnd = (edgeId: string) => `${edgeId}|source`;
export const targetEnd = (edgeId: string) => `${edgeId}|target`;

/** Which side of which box an endpoint meets. */
export const atSide = (nodeId: string, side: string) => `${nodeId}|${side}`;
