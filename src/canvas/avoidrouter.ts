import type { Point, Side } from '../designsystem';

/**
 * Relation lines routed around the classes, by libavoid.
 *
 * A relation used to be drawn as a plain step between the two classes it joins, which takes no
 * notice of anything else on the canvas. Where a third class stood in the way the line ran behind
 * it and came out the other side, and a line that disappears into a class reads as one that ends
 * there. libavoid is the standard answer to that: it routes right-angled lines around boxes, and
 * spaces apart lines that share a stretch of the way.
 *
 * Only the middle of a line is libavoid's. Which side each end leaves from, and where along that
 * side, is still decided the way it always was (`chooseSides`, a side pinned by hand, the fan in
 * `bundles.ts`), and each end is handed to libavoid as a connection point at exactly that place,
 * so a line starts and ends where it did before.
 *
 * One router lives as long as the canvas, and each scene is applied to it as a change: classes
 * moved, lines added or taken away. libavoid then re-routes only what that change affects, which
 * is what keeps up with a class being dragged.
 */

/** A class, as the router sees it: a box to keep out of, at its top-left corner. */
export interface RoutingShape {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One end of a line: the side of the class it meets, and how far along from the middle. */
export interface RoutingEnd {
  shape: string;
  side: Side;
  offset: number;
}

export interface RoutingConnector {
  id: string;
  from: RoutingEnd;
  to: RoutingEnd;
}

/** Everything on the canvas the routes depend on. */
export interface RoutingScene {
  shapes: readonly RoutingShape[];
  connectors: readonly RoutingConnector[];
}

export interface AvoidRouter {
  /** Applies the scene and returns every line's route, from its first end to its second. */
  route(scene: RoutingScene): Map<string, Point[]>;
  dispose(): void;
}

/*
 * The slice of libavoid used here, as it behaves at run time. The package's own typings describe
 * an older build: its enums are declared empty and `RouterFlag` is missing, so they cannot check
 * anything. This is narrower and true, and it is checked by the tests, which run the real library.
 */
/** Anything libavoid allocates: freed by hand, since wasm memory is not garbage-collected. */
interface WasmObject {
  delete(): void;
}
interface AvoidPoint extends WasmObject {
  x: number;
  y: number;
}
type Polygon = WasmObject;
type ShapeRef = WasmObject;
interface ConnectionPin extends WasmObject {
  setExclusive(exclusive: boolean): void;
}
type ConnEnd = WasmObject;
interface ConnRef extends WasmObject {
  displayRoute(): { size(): number; at(index: number): AvoidPoint };
}
interface RouterRef extends WasmObject {
  setRoutingParameter(parameter: unknown, value: number): void;
  setRoutingOption(option: unknown, value: boolean): void;
  processTransaction(): void;
  moveShape_poly(shape: ShapeRef, polygon: Polygon, firstMove: boolean): void;
  deleteShape(shape: ShapeRef): void;
  deleteConnector(connector: ConnRef): void;
}
export interface AvoidApi {
  Router: new (flags: number) => RouterRef;
  RouterFlag: { OrthogonalRouting: { value: number } };
  RoutingParameter: Record<
    'shapeBufferDistance' | 'idealNudgingDistance' | 'segmentPenalty',
    unknown
  >;
  RoutingOption: Record<'performUnifyingNudgingPreprocessingStep', unknown>;
  Point: new (x: number, y: number) => AvoidPoint;
  Rectangle: new (centre: AvoidPoint, width: number, height: number) => Polygon;
  ShapeRef: new (router: RouterRef, polygon: Polygon) => ShapeRef;
  ShapeConnectionPin: new (
    shape: ShapeRef,
    classId: number,
    xOffset: number,
    yOffset: number,
    proportional: boolean,
    insideOffset: number,
    directions: number,
  ) => ConnectionPin;
  ConnEnd: new (shape: ShapeRef, classId: number) => ConnEnd;
  ConnRef: new (router: RouterRef, from: ConnEnd, to: ConnEnd) => ConnRef;
}

/** How far a line keeps from a class it passes, in pixels. */
const CLEARANCE = 12;

/** How far apart lines sharing a stretch of the way are spread. Matches the fan at the ends. */
const SPACING = 10;

/**
 * What a bend costs, in pixels of length. Without it the shortest route zig-zags; libavoid also
 * requires it to be above zero.
 */
const BEND_COST = 10;

/** libavoid's direction flags, one per side: the way a line leaves through it. */
const LEAVES: Record<Side, number> = { top: 1, bottom: 2, left: 4, right: 8 };

/** Where on its box an end sits, as fractions of the box's width and height. */
function attachment(end: RoutingEnd, box: RoutingShape): { x: number; y: number } {
  const across = 0.5 + end.offset / box.width;
  const down = 0.5 + end.offset / box.height;
  switch (end.side) {
    case 'top':
      return { x: across, y: 0 };
    case 'bottom':
      return { x: across, y: 1 };
    case 'left':
      return { x: 0, y: down };
    case 'right':
      return { x: 1, y: down };
  }
}

const boxKey = (box: RoutingShape) => `${box.x},${box.y},${box.width},${box.height}`;
const sizeKey = (box: RoutingShape) => `${box.width},${box.height}`;

export function createAvoidRouter(avoid: AvoidApi): AvoidRouter {
  const router = new avoid.Router(avoid.RouterFlag.OrthogonalRouting.value);
  router.setRoutingParameter(avoid.RoutingParameter.shapeBufferDistance, CLEARANCE);
  router.setRoutingParameter(avoid.RoutingParameter.idealNudgingDistance, SPACING);
  router.setRoutingParameter(avoid.RoutingParameter.segmentPenalty, BEND_COST);
  /*
   * Off, and it is the setting that decides whether this is usable on a crowded schema. The
   * pre-pass lines up segments before they are spaced apart, and its cost climbs steeply as lines
   * crowd together: on 60 classes joined by 132 relations it took routing from 32 ms to over a
   * second. The spacing still happens without it.
   */
  router.setRoutingOption(avoid.RoutingOption.performUnifyingNudgingPreprocessingStep, false);

  /*
   * libavoid groups connection points into classes, and a line asks for one by its class. A class
   * here is a place on a box -- a side, and an offset along it -- shared by every box that has a
   * line there. One class per line end was tried first, and libavoid stopped finding routes once
   * a schema had a few dozen lines, falling back to straight lines through everything.
   */
  const placeClass = new Map<string, number>();
  const classOf = (end: RoutingEnd) => {
    const place = `${end.side}:${end.offset}`;
    let id = placeClass.get(place);
    if (id === undefined) {
      id = placeClass.size + 1;
      placeClass.set(place, id);
    }
    return id;
  };

  // The connection points on a box belong to it, and go when it goes.
  const shapes = new Map<string, { ref: ShapeRef; box: RoutingShape; places: Set<number> }>();
  const lines = new Map<string, { ref: ConnRef; signature: string }>();

  /** A libavoid rectangle for the box, freed by the caller: wasm memory is not collected. */
  function rectangle(box: RoutingShape): Polygon {
    const centre = new avoid.Point(box.x + box.width / 2, box.y + box.height / 2);
    const polygon = new avoid.Rectangle(centre, box.width, box.height);
    centre.delete();
    return polygon;
  }

  /** The end of a line at its place on its box, making the connection point there if need be. */
  function endAt(end: RoutingEnd): ConnEnd | null {
    const shape = shapes.get(end.shape);
    if (!shape) return null;
    const place = classOf(end);
    if (!shape.places.has(place)) {
      const at = attachment(end, shape.box);
      const pin = new avoid.ShapeConnectionPin(
        shape.ref,
        place,
        at.x,
        at.y,
        true,
        0,
        LEAVES[end.side],
      );
      // Shared: two lines may meet a class at the same place.
      pin.setExclusive(false);
      shape.places.add(place);
    }
    return new avoid.ConnEnd(shape.ref, place);
  }

  /*
   * What a line's route depends on besides where the classes are: its ends, and the sizes of the
   * boxes they are on, since a connection point is placed in proportion to its box.
   */
  function signatureOf(line: RoutingConnector, boxes: ReadonlyMap<string, RoutingShape>): string {
    const end = (e: RoutingEnd) => {
      const box = boxes.get(e.shape);
      return `${e.shape}:${e.side}:${e.offset}:${box ? sizeKey(box) : ''}`;
    };
    return `${end(line.from)}>${end(line.to)}`;
  }

  return {
    route(scene) {
      const boxes = new Map(scene.shapes.map((box) => [box.id, box]));
      const wanted = new Map(scene.connectors.map((line) => [line.id, line]));

      // Lines that are gone, or whose ends have changed, come out first.
      for (const [id, line] of lines) {
        const next = wanted.get(id);
        if (next && signatureOf(next, boxes) === line.signature) continue;
        router.deleteConnector(line.ref);
        lines.delete(id);
      }

      for (const [id, shape] of shapes) {
        const box = boxes.get(id);
        // One that has changed size is replaced, so its connection points are placed afresh.
        if (box && sizeKey(box) === sizeKey(shape.box)) continue;
        router.deleteShape(shape.ref);
        shapes.delete(id);
      }
      for (const box of scene.shapes) {
        const shape = shapes.get(box.id);
        if (shape && boxKey(shape.box) === boxKey(box)) continue;
        const polygon = rectangle(box);
        if (shape) {
          router.moveShape_poly(shape.ref, polygon, false);
          shape.box = box;
        } else {
          shapes.set(box.id, { ref: new avoid.ShapeRef(router, polygon), box, places: new Set() });
        }
        polygon.delete();
      }

      for (const line of scene.connectors) {
        if (lines.has(line.id)) continue;
        const from = endAt(line.from);
        const to = endAt(line.to);
        if (from && to) {
          lines.set(line.id, {
            ref: new avoid.ConnRef(router, from, to),
            signature: signatureOf(line, boxes),
          });
        }
        from?.delete();
        to?.delete();
      }

      router.processTransaction();

      const routes = new Map<string, Point[]>();
      for (const [id, line] of lines) {
        const polyline = line.ref.displayRoute();
        const points: Point[] = [];
        for (let index = 0; index < polyline.size(); index += 1) {
          const { x, y } = polyline.at(index);
          points.push({ x, y });
        }
        routes.set(id, points);
      }
      return routes;
    },

    dispose() {
      router.delete();
    },
  };
}
