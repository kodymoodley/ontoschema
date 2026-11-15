import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { EDGE_TYPE } from './graphmodel';
import { keepUnchanged, routingScene } from './useAvoidedEdges';

/**
 * What the router is told about the canvas. It is built from React Flow's own nodes and edges, so
 * these check it reads them the way the canvas draws them: measured sizes, the side each handle is
 * on, and the fan offsets the edges carry.
 */

const node = (id: string, x: number, y: number, measured = true): Node => ({
  id,
  position: { x, y },
  data: {},
  ...(measured ? { measured: { width: 224, height: 120 } } : {}),
});

const relation = (id: string, source: string, target: string, data = {}): Edge => ({
  id,
  type: EDGE_TYPE.relation,
  source,
  target,
  sourceHandle: 'source-right',
  targetHandle: 'target-left',
  data,
});

describe('the scene the router is given', () => {
  it('takes each class where it is drawn, at the size it measured', () => {
    const scene = routingScene([node('a', 10, 20), node('b', 400, 20)], []);
    expect(scene?.shapes).toEqual([
      { id: 'a', x: 10, y: 20, width: 224, height: 120 },
      { id: 'b', x: 400, y: 20, width: 224, height: 120 },
    ]);
  });

  it('waits until every class has been measured', () => {
    expect(routingScene([node('a', 0, 0), node('b', 400, 0, false)], [])).toBeNull();
  });

  it('takes each relation by the sides of its handles and its fan offsets', () => {
    const scene = routingScene(
      [node('a', 0, 0), node('b', 400, 0)],
      [relation('r', 'a', 'b', { sourceOffset: 13, targetOffset: -13 })],
    );
    expect(scene?.connectors).toEqual([
      {
        id: 'r',
        from: { shape: 'a', side: 'right', offset: 13 },
        to: { shape: 'b', side: 'left', offset: -13 },
      },
    ]);
  });

  it('leaves out lines that are not relations, or whose sides it cannot read', () => {
    const scene = routingScene(
      [node('a', 0, 0), node('b', 400, 0)],
      [
        { ...relation('subclass', 'a', 'b'), type: EDGE_TYPE.subClassOf },
        { ...relation('loose', 'a', 'b'), sourceHandle: null },
      ],
    );
    expect(scene?.connectors).toEqual([]);
  });
});

describe('taking in a new set of routes', () => {
  it('keeps the old route for a line that has not moved, and takes the new one where it has', () => {
    const still = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const before = new Map([
      ['still', still],
      [
        'moved',
        [
          { x: 0, y: 0 },
          { x: 0, y: 50 },
        ],
      ],
    ]);
    const after = keepUnchanged(
      before,
      new Map([
        ['still', still.map((point) => ({ ...point }))],
        [
          'moved',
          [
            { x: 0, y: 0 },
            { x: 0, y: 80 },
          ],
        ],
        [
          'new',
          [
            { x: 5, y: 5 },
            { x: 9, y: 5 },
          ],
        ],
      ]),
    );
    expect(after.get('still')).toBe(still);
    expect(after.get('moved')).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 80 },
    ]);
    expect([...after.keys()]).toEqual(['still', 'moved', 'new']);
  });
});
