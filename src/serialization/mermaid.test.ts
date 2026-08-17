import { describe, expect, it } from 'vitest';
import { buildAutoOntology } from '../../tests/fixtures/autoOntology';
import { addAttributeToClass, addClass, createEmptyOntology } from '../ontologymodel';
import type { Ontology } from '../ontologymodel';
import { serialize } from './index';
import { serializeMermaid } from './mermaid';

/**
 * The diagram writer.
 *
 * Checked by reading rather than by parsing, since there is no Mermaid parser here to check it
 * with. That puts the weight on the assertions being about the grammar Mermaid requires — the
 * shape of a class block, the direction of the inheritance arrow — rather than about whatever
 * string the writer happens to produce today.
 */

const { ontology: auto } = buildAutoOntology();
const diagram = serializeMermaid(auto);

const emptyOntology = () => createEmptyOntology('https://example.org/x/', 'x');

describe('the diagram as a whole', () => {
  it('opens by declaring what kind of diagram it is', () => {
    expect(diagram.split('\n')[0]).toBe('classDiagram');
  });

  it('ends with a newline, like every other writer here', () => {
    expect(diagram.endsWith('\n')).toBe(true);
  });

  it('does not move between runs', () => {
    expect(serializeMermaid(auto)).toBe(diagram);
  });

  it('is reachable through the shared entry point, named .mmd', () => {
    const file = serialize(auto, 'mermaid', 'Cars');
    expect(file.filename).toBe('Cars.mmd');
    expect(file.content).toBe(diagram);
  });
});

describe('classes and their attributes', () => {
  it('gives every class a block', () => {
    expect(diagram).toMatch(/\bclass Car\b/);
    expect(diagram).toMatch(/\bclass Dealership\b/);
  });

  /*
   * `xsd:string` would read as a namespace to someone looking at the picture, and Mermaid treats
   * a colon as the start of a member declaration, so the datatype's own name goes in alone.
   */
  it('writes an attribute as a typed member, without the namespace', () => {
    expect(diagram).toContain('+string make');
    expect(diagram).not.toContain('xsd:');
  });

  /*
   * Ordered by attribute name. Mermaid puts the type first, so sorting the finished line groups a
   * class by datatype instead — which is not how anyone scans a list looking for one attribute.
   */
  it('lists attributes by name rather than grouped by datatype', () => {
    const block = /class Car \{([\s\S]*?)\}/.exec(diagram)?.[1] ?? '';
    const names = [...block.matchAll(/\+\w+ (\w+)/g)].map((match) => match[1]);
    expect(names.length).toBeGreaterThan(2);
    expect(names).toEqual([...names].sort());
  });

  it('leaves a class with no attributes as a bare declaration', () => {
    const { ontology } = addClass(emptyOntology(), { localName: 'Lonely' });
    expect(serializeMermaid(ontology)).toContain('  class Lonely\n');
    expect(serializeMermaid(ontology)).not.toContain('class Lonely {');
  });
});

describe('the lines between classes', () => {
  it('points the hollow triangle from the parent to the child', () => {
    expect(diagram).toContain('Vehicle <|-- Car');
  });

  it('labels an association with the relation it stands for', () => {
    expect(diagram).toMatch(/Car --> Dealership : offeredBy/);
  });

  it('draws one arrow when the same relation joins one pair twice', () => {
    const arrows = diagram.split('\n').filter((line) => line.includes('-->'));
    expect(new Set(arrows).size).toBe(arrows.length);
  });
});

describe('names Mermaid would refuse', () => {
  /*
   * Reachable. A dot and a dash are both legal in an NCName and the model keeps them, so
   * `Lease.Agreement-2` is a name someone can really type. Mermaid will not parse it as an
   * identifier, and the result is not a wrong picture but a file that does not render at all.
   */
  it('cleans a name the model itself allows', () => {
    const { ontology } = addClass(emptyOntology(), { localName: 'Lease.Agreement-2' });
    expect(ontology.classes[0]?.localName, 'the model keeps this name as typed').toBe(
      'Lease.Agreement-2',
    );
    expect(serializeMermaid(ontology)).toContain('class Lease_Agreement_2');
  });

  it('cleans an attribute name too, not only a class name', () => {
    const created = addClass(emptyOntology(), { localName: 'Car' });
    const { ontology } = addAttributeToClass(created.ontology, {
      classId: created.id,
      localName: 'model.year',
      range: 'integer',
    });
    expect(serializeMermaid(ontology)).toContain('+integer model_year');
  });

  /*
   * Not reachable, and kept as defence in depth rather than dressed up as a real case. The model
   * puts an underscore in front of a leading digit already, so this needs an ontology built by
   * hand to reach — a hand-edited project file would be the way it arrived.
   */
  it('does not leave an identifier starting with a digit', () => {
    const ontology: Ontology = {
      ...emptyOntology(),
      classes: [
        {
          id: 'c1',
          localName: '2ndParty',
          superClassIds: [],
          annotations: [],
          position: { x: 0, y: 0 },
        },
      ],
    };
    expect(serializeMermaid(ontology)).toContain('class _2ndParty');
  });
});
