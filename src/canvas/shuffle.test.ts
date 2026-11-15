import { describe, expect, it, vi } from 'vitest';
import { EXAMPLES } from '../examplelibrary';
import { addClass, addRelationBetween, createEmptyOntology } from '../ontologymodel';
import type { Ontology, Position } from '../ontologymodel';
import { arrangeSchema, schemaGraph } from './arrange';
import * as d3dag from './d3daglayout';
import { dagreGroup, pack } from './layeredlayout';
import type { Direction, LayoutGraph } from './layeredlayout';
import { scoreLayout } from './layoutscore';
import { shuffleLayout } from './shuffle';
import type { ShuffleRequest } from './shuffle';

/**
 * The shuffle's promises: every class placed, nothing overlapping, never worse than Tidy up in
 * the same direction, and never what is already on screen when there is anything else to show.
 */

vi.mock('./d3daglayout', { spy: true });

/** A budget no test reaches, so every run tries the same number of layouts on any machine. */
const PLENTY = 60_000;

function request(ontology: Ontology, overrides: Partial<ShuffleRequest> = {}): ShuffleRequest {
  return {
    graph: schemaGraph(ontology),
    current: arrangeSchema(ontology),
    direction: 'TB',
    seed: 1,
    budgetMs: PLENTY,
    ...overrides,
  };
}

const score = (graph: LayoutGraph, positions: ReadonlyMap<string, Position>) =>
  scoreLayout(positions, graph.boxes, graph.links).value;

/** Tidy up's layout turned to `direction`: the bar a shuffle has to clear. */
const tidy = (graph: LayoutGraph, direction: Direction) =>
  pack(graph.groups.map((members) => dagreGroup(graph, members, { direction })));

function overlapping(graph: LayoutGraph, positions: ReadonlyMap<string, Position>): string[] {
  const rects = [...positions].map(([id, { x, y }]) => ({ id, x, y, ...graph.boxes.get(id)! }));
  const found: string[] = [];
  rects.forEach((a, index) => {
    for (const b of rects.slice(index + 1)) {
      const apart =
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y;
      if (!apart) found.push(`${a.id} and ${b.id}`);
    }
  });
  return found;
}

/** A chain of `count` classes, each pointing at the next. */
function chain(count: number): Ontology {
  let ontology = createEmptyOntology();
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const added = addClass(ontology, { localName: `Class${index}` });
    ontology = added.ontology;
    ids.push(added.id);
  }
  ids.slice(1).forEach((to, index) => {
    ontology = addRelationBetween(ontology, {
      localName: `points${index}`,
      subjectClassId: ids[index]!,
      objectClassId: to,
    }).ontology;
  });
  return ontology;
}

describe.each(EXAMPLES.map((example) => [example.title, example.build()] as const))(
  'shuffling %s',
  (_title, ontology) => {
    it.each(['TB', 'LR'] as const)(
      'places every class, with none overlapping (%s)',
      (direction) => {
        const { graph, ...rest } = request(ontology, { direction });
        const { positions } = shuffleLayout({ graph, ...rest });
        expect([...positions.keys()].sort()).toEqual(ontology.classes.map((c) => c.id).sort());
        expect(overlapping(graph, positions)).toEqual([]);
      },
    );

    it.each(['TB', 'LR'] as const)('is never worse than Tidy up (%s)', (direction) => {
      const asked = request(ontology, { direction });
      const { positions } = shuffleLayout(asked);
      expect(score(asked.graph, positions)).toBeLessThanOrEqual(
        score(asked.graph, tidy(asked.graph, direction)),
      );
    });

    it('shows something different each time it is pressed', () => {
      const first = shuffleLayout(request(ontology));
      const second = shuffleLayout(request(ontology, { current: first.positions, seed: 2 }));
      expect(first.changed).toBe(true);
      expect(second.changed).toBe(true);
      expect(second.positions).not.toEqual(first.positions);
    });
  },
);

describe('shuffling', () => {
  it('untangles what Tidy up leaves crossed', () => {
    // The music example: Tidy up, top to bottom, leaves four lines crossing and one through a class.
    const ontology = EXAMPLES[0]!.build();
    const asked = request(ontology);
    const { positions } = shuffleLayout(asked);
    const after = scoreLayout(positions, asked.graph.boxes, asked.graph.links);
    expect({ crossings: after.crossings, through: after.through }).toEqual({
      crossings: 0,
      through: 0,
    });
  });

  it('runs its ranks the way it is asked to', () => {
    const ontology = chain(4);
    const ids = ontology.classes.map((entity) => entity.id);
    const along = (direction: Direction, axis: 'x' | 'y') => {
      const { positions } = shuffleLayout(request(ontology, { direction }));
      return ids.map((id) => positions.get(id)![axis]);
    };
    const increasing = (values: number[]) =>
      values.every((value, i) => i === 0 || value > values[i - 1]!);
    expect(increasing(along('TB', 'y'))).toBe(true);
    expect(increasing(along('LR', 'x'))).toBe(true);
  });

  it('gives the same layout for the same seed', () => {
    const ontology = EXAMPLES[2]!.build();
    expect(shuffleLayout(request(ontology, { seed: 7 })).positions).toEqual(
      shuffleLayout(request(ontology, { seed: 7 })).positions,
    );
  });

  it('says so, and moves nothing, when what is on screen is already the only good layout', () => {
    // Two classes and a line: top to bottom, there is one way to draw it, and it is showing.
    const ontology = chain(2);
    const graph = schemaGraph(ontology);
    const showing = tidy(graph, 'TB');
    const result = shuffleLayout(request(ontology, { current: showing }));
    expect(result.changed).toBe(false);
    expect(result.positions).toEqual(showing);
  });

  it('has nothing to do for an empty schema', () => {
    expect(shuffleLayout(request(createEmptyOntology()))).toEqual({
      positions: new Map(),
      changed: false,
    });
  });

  it('stops trying once its time is up, after one try for each group', () => {
    vi.mocked(d3dag.d3dagGroup).mockClear();
    const ontology = EXAMPLES[2]!.build();
    // A clock that has already run out by the time it is first asked again.
    let now = 0;
    const clock = () => (now += 1_000);
    const groups = schemaGraph(ontology).groups.filter((members) => members.length >= 3).length;

    const result = shuffleLayout(request(ontology, { budgetMs: 10 }), clock);

    expect(vi.mocked(d3dag.d3dagGroup)).toHaveBeenCalledTimes(groups);
    expect(result.changed).toBe(true);
  });
});

describe('making a schema acyclic for d3-dag', () => {
  const link = (from: string, to: string) => ({ from, to, weight: 4, drawn: true });

  it('keeps every link, turning round the ones that close a loop', () => {
    const pairs = d3dag.acyclicPairs(
      [link('a', 'b'), link('b', 'c'), link('c', 'a')],
      ['a', 'b', 'c'],
    );
    expect(pairs).toEqual([
      ['a', 'b'],
      ['b', 'c'],
      ['a', 'c'],
    ]);
  });

  it('merges links that end up joining the same two classes the same way', () => {
    expect(
      d3dag.acyclicPairs([link('a', 'b'), link('b', 'a'), link('a', 'b')], ['a', 'b']),
    ).toEqual([['a', 'b']]);
  });

  it('breaks the loop somewhere else when the walk starts somewhere else', () => {
    const loop = [link('a', 'b'), link('b', 'c'), link('c', 'a')];
    expect(d3dag.acyclicPairs(loop, ['b', 'c', 'a'])).toContainEqual(['b', 'a']);
  });
});
