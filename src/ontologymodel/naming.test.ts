import { describe, expect, it } from 'vitest';
import { addAttribute, addClass, addRelation } from './mutations';
import { holderOfName, nameProblem } from './naming';
import { createEmptyOntology } from './ontology';

/**
 * Whose a name is, and the words a field uses when a typed name cannot be had.
 */

function vehicles() {
  const vehicle = addClass(createEmptyOntology(), { localName: 'Vehicle' });
  const usedCar = addClass(vehicle.ontology, { localName: 'UsedCar' });
  const owner = addRelation(usedCar.ontology, { localName: 'hasOwner' });
  const price = addAttribute(owner.ontology, { localName: 'price' });
  return {
    ontology: price.ontology,
    ids: { vehicle: vehicle.id, usedCar: usedCar.id, owner: owner.id, price: price.id },
  };
}

describe('holderOfName', () => {
  it('finds the term with a name, of whichever kind, since all share one namespace', () => {
    const { ontology, ids } = vehicles();

    expect(holderOfName(ontology, 'Vehicle')).toMatchObject({ kind: 'class', id: ids.vehicle });
    expect(holderOfName(ontology, 'hasOwner')).toMatchObject({ kind: 'relation', id: ids.owner });
    expect(holderOfName(ontology, 'price')).toMatchObject({ kind: 'attribute', id: ids.price });
    expect(holderOfName(ontology, 'Truck')).toBeUndefined();
  });

  it('leaves out the term being renamed, whose own name is not in its way', () => {
    const { ontology, ids } = vehicles();
    expect(holderOfName(ontology, 'Vehicle', ids.vehicle)).toBeUndefined();
  });

  it('matches exactly, so names differing in case are different names', () => {
    const { ontology } = vehicles();
    expect(holderOfName(ontology, 'vehicle')).toBeUndefined();
  });
});

describe('nameProblem', () => {
  it('says nothing about a free name', () => {
    const { ontology } = vehicles();
    expect(nameProblem(ontology, 'class', 'Truck')).toBeUndefined();
  });

  it('asks for a name when nothing usable was typed', () => {
    const { ontology } = vehicles();
    expect(nameProblem(ontology, 'class', '   ')).toBe('A class needs a name.');
    expect(nameProblem(ontology, 'attribute', '///')).toBe('An attribute needs a name.');
  });

  it('names the term holding it, judged as the typed name will be written', () => {
    const { ontology } = vehicles();
    // `used car` is written `UsedCar` for a class, which another class already is.
    expect(nameProblem(ontology, 'class', 'used car')).toBe('UsedCar is already a class.');
    expect(nameProblem(ontology, 'relation', 'has owner')).toBe('hasOwner is already a relation.');
  });

  it('explains a name held by the other kind of property', () => {
    const { ontology } = vehicles();
    expect(nameProblem(ontology, 'attribute', 'hasOwner')).toBe(
      'hasOwner is already a relation, so an attribute cannot be called that too.',
    );
  });

  it('lets a term keep its own name', () => {
    const { ontology, ids } = vehicles();
    expect(nameProblem(ontology, 'class', 'Vehicle', ids.vehicle)).toBeUndefined();
  });
});
