import { describe, expect, it } from 'vitest';
import { atSide, endpointOffsets, sourceEnd, targetEnd } from './bundles';

/**
 * Fanning apart the edge ends that meet a class at the same place.
 *
 * The property that matters most is the one about *not* acting: an end with its side to itself
 * must come out exactly where it always did. A fix for crowded diagrams that quietly nudges every
 * uncrowded one is not a fix.
 *
 * Grouping is by **side of a box**, not by pair of classes. Pairs were tried first and left nine
 * collisions standing in a single published ontology, because two relations can meet the same
 * side of the same class without sharing a pair at all — `hasPart` arrives at Part's top while
 * `hasCredit` leaves from it.
 */

/** One end of one edge, meeting a named side of a named box. */
const end = (
  edgeId: string,
  node: string,
  side: string,
  which: 'source' | 'target' = 'source',
) => ({
  key: which === 'source' ? sourceEnd(edgeId) : targetEnd(edgeId),
  at: atSide(node, side),
});

describe('ends meeting the same side of a class', () => {
  it('leaves an end that has its side to itself alone', () => {
    const offsets = endpointOffsets([end('one', 'A', 'right'), end('two', 'A', 'top')]);
    expect(offsets.get(sourceEnd('one'))).toBe(0);
    expect(offsets.get(sourceEnd('two'))).toBe(0);
  });

  /*
   * The case this exists for. An inverse pair puts a tail and a head on the same side of the
   * same box, so one arrowhead landed on the other's tail and the two read as a single line with
   * a head at each end.
   */
  it('pulls a tail and a head apart when they meet the same side', () => {
    const offsets = endpointOffsets([
      end('there', 'A', 'right', 'source'),
      end('back', 'A', 'right', 'target'),
    ]);
    const tail = offsets.get(sourceEnd('there'));
    const head = offsets.get(targetEnd('back'));
    expect(tail).toBeDefined();
    expect(head).toBeDefined();
    if (tail === undefined || head === undefined) return;

    expect(tail).not.toBe(head);
    // Either side of where a lone end would have been, rather than both shoved one way.
    expect(tail).toBe(-head);
    expect(Math.abs(tail)).toBeGreaterThan(0);
  });

  /* Different sides of one class do not collide, so they must not be fanned. */
  it('keeps the sides of a class separate from each other', () => {
    const offsets = endpointOffsets([
      end('one', 'A', 'right'),
      end('two', 'A', 'left'),
      end('three', 'A', 'top'),
      end('four', 'A', 'bottom'),
    ]);
    expect([...offsets.values()]).toEqual([0, 0, 0, 0]);
  });

  it('keeps the middle lane for the middle end of an odd bundle', () => {
    const offsets = endpointOffsets([
      end('one', 'A', 'right'),
      end('two', 'A', 'right'),
      end('three', 'A', 'right'),
    ]);
    const lanes = [sourceEnd('one'), sourceEnd('two'), sourceEnd('three')].map((key) =>
      offsets.get(key),
    );
    expect(lanes).toContain(0);
    expect(Math.min(...lanes.map((lane) => lane ?? NaN))).toBe(
      -Math.max(...lanes.map((lane) => lane ?? NaN)),
    );
  });

  it('gives every end at a side a lane of its own', () => {
    const members = ['a', 'b', 'c', 'd', 'e'].map((id) => end(id, 'A', 'right'));
    const offsets = endpointOffsets(members);
    const lanes = members.map((member) => offsets.get(member.key));
    expect(new Set(lanes).size).toBe(members.length);
  });

  /*
   * A class box is 224 wide and often under 120 tall. An unbounded fan would slide ends off the
   * end of the side they attach to, which trades one wrong picture for another.
   */
  it('packs a crowded side closer rather than spreading it off the box', () => {
    const many = Array.from({ length: 12 }, (_, index) => end(`e${index}`, 'A', 'right'));
    const offsets = [...endpointOffsets(many).values()];
    expect(Math.max(...offsets.map(Math.abs))).toBeLessThanOrEqual(26);
  });

  /*
   * The same schema always draws the same way, and an edit elsewhere must not shuffle lines that
   * had nothing to do with it.
   */
  it('assigns the same lanes however the ends arrive', () => {
    const members = ['c', 'a', 'd', 'b'].map((id) => end(id, 'A', 'right'));
    const forwards = endpointOffsets(members);
    const backwards = endpointOffsets([...members].reverse());
    for (const member of members) {
      expect(backwards.get(member.key)).toBe(forwards.get(member.key));
    }
  });

  it('has nothing to say about an empty diagram', () => {
    expect(endpointOffsets([]).size).toBe(0);
  });

  it('keeps two classes from sharing a bundle', () => {
    const offsets = endpointOffsets([
      end('one', 'A', 'right'),
      end('two', 'A', 'right'),
      end('lonely', 'B', 'right'),
    ]);
    expect(offsets.get(sourceEnd('lonely'))).toBe(0);
    expect(offsets.get(sourceEnd('one'))).not.toBe(0);
  });
});
