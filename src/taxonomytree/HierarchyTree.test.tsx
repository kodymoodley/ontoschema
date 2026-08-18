import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DRAG_MIME, encodeDragPayload, useProjectStore } from '../projectstore';
import { findClass } from '../ontologymodel';
import { HierarchyTree } from './HierarchyTree';

const store = () => useProjectStore.getState();
const ontology = () => {
  const state = useProjectStore.getState();
  const project = state.projects.find((candidate) => candidate.id === state.activeProjectId);
  if (!project) throw new Error('no active project');
  return project.ontology;
};

const item = (name: string) => document.querySelector<HTMLElement>(`[data-tree-item="${name}"]`);
const poolRow = (name: string) =>
  document.querySelector<HTMLElement>(`[data-datatype-property="${name}"]`);

/**
 * jsdom raises drag events without a `dataTransfer`, which real browsers always supply.
 * Handlers touch it, so the tests provide one rather than pretending drags are free.
 */
function dragData(sink: Record<string, string> = {}) {
  return {
    dataTransfer: {
      setData: (type: string, value: string) => {
        sink[type] = value;
      },
      getData: (type: string) => sink[type] ?? '',
      effectAllowed: 'move',
      dropEffect: 'move',
    },
  };
}

describe('HierarchyTree — classes', () => {
  it('nests a subclass under its parent', async () => {
    const user = userEvent.setup();
    const vehicle = store().createClass({ localName: 'Vehicle' });
    const car = store().createClass({ localName: 'Car' });
    store().reparentClass(car, vehicle);
    render(<HierarchyTree />);

    expect(item('Vehicle')).not.toBeNull();
    // Car is rendered inside Vehicle's subtree, not as a sibling root.
    expect(item('Vehicle')?.parentElement?.contains(item('Car') as Node)).toBe(true);
    await user.click(item('Car') as HTMLElement);
    expect(store().selection).toEqual({ kind: 'class', id: car });
  });

  it('selects a row from the keyboard', async () => {
    const user = userEvent.setup();
    const car = store().createClass({ localName: 'Car' });
    render(<HierarchyTree />);

    (item('Car') as HTMLElement).focus();
    await user.keyboard('{Enter}');
    expect(store().selection).toEqual({ kind: 'class', id: car });
  });

  it('adds a root and a child of the selection', async () => {
    const user = userEvent.setup();
    render(<HierarchyTree />);

    await user.click(screen.getByRole('button', { name: 'Add root class' }));
    expect(ontology().classes).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Add child class' }));
    expect(ontology().classes).toHaveLength(2);
    const child = ontology().classes[1];
    expect(child?.superClassIds).toEqual([ontology().classes[0]?.id]);
  });

  it('disables adding a child and deleting with nothing selected', () => {
    store().createClass({ localName: 'Car' });
    store().select(null);
    render(<HierarchyTree />);
    expect(screen.getByRole('button', { name: 'Add child class' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete selected class' })).toBeDisabled();
  });

  it('re-parents by dragging one row onto another', () => {
    const vehicle = store().createClass({ localName: 'Vehicle' });
    const car = store().createClass({ localName: 'Car' });
    render(<HierarchyTree />);

    fireEvent.dragStart(item('Car') as HTMLElement, dragData());
    fireEvent.dragOver(item('Vehicle') as HTMLElement, dragData());
    fireEvent.drop(item('Vehicle') as HTMLElement, dragData());

    expect(findClass(ontology(), car)?.superClassIds).toEqual([vehicle]);
  });

  it('refuses a drag that would close a cycle', () => {
    const vehicle = store().createClass({ localName: 'Vehicle' });
    const car = store().createClass({ localName: 'Car' });
    store().reparentClass(car, vehicle);
    render(<HierarchyTree />);

    // Vehicle is already above Car; dropping Vehicle onto Car would make a loop.
    fireEvent.dragStart(item('Vehicle') as HTMLElement, dragData());
    fireEvent.dragOver(item('Car') as HTMLElement, dragData());
    fireEvent.drop(item('Car') as HTMLElement, dragData());

    expect(findClass(ontology(), vehicle)?.superClassIds).toEqual([]);
    expect(findClass(ontology(), car)?.superClassIds).toEqual([vehicle]);
  });

  it('promotes a class to a root by dropping it on empty space', () => {
    const vehicle = store().createClass({ localName: 'Vehicle' });
    const car = store().createClass({ localName: 'Car' });
    store().reparentClass(car, vehicle);
    render(<HierarchyTree />);

    fireEvent.dragStart(item('Car') as HTMLElement, dragData());
    fireEvent.drop(screen.getByRole('tree', { name: 'Class hierarchy' }), dragData());

    expect(findClass(ontology(), car)?.superClassIds).toEqual([]);
  });

  it('collapses and expands a subtree', async () => {
    const user = userEvent.setup();
    const vehicle = store().createClass({ localName: 'Vehicle' });
    const car = store().createClass({ localName: 'Car' });
    store().reparentClass(car, vehicle);
    render(<HierarchyTree />);

    await user.click(screen.getByRole('button', { name: 'Collapse Vehicle' }));
    expect(item('Car')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Expand Vehicle' }));
    expect(item('Car')).not.toBeNull();
  });
});

describe('HierarchyTree — relations', () => {
  it('marks a property that is not used anywhere', async () => {
    const user = userEvent.setup();
    store().createRelation({ localName: 'hasPart' });
    render(<HierarchyTree />);

    await user.click(screen.getByRole('tab', { name: 'Relation' }));
    expect(item('hasPart')).toHaveTextContent('unused');
  });

  it('counts how many times a property is used', async () => {
    const user = userEvent.setup();
    const car = store().createClass({ localName: 'Car' });
    const wheel = store().createClass({ localName: 'Wheel' });
    const hasPart = store().createRelation({ localName: 'hasPart' });
    store().attachPropertyToClass(hasPart, car, wheel);
    render(<HierarchyTree />);

    await user.click(screen.getByRole('tab', { name: 'Relation' }));
    expect(item('hasPart')).toHaveTextContent('1×');
  });
});

describe('HierarchyTree — attribute pool', () => {
  it('lists properties alphabetically with their range and usage count', async () => {
    const user = userEvent.setup();
    const car = store().createClass({ localName: 'Car' });
    store().createAttributeOn(car, { localName: 'year', range: 'integer' });
    store().createAttributeOn(car, { localName: 'make', range: 'string' });
    render(<HierarchyTree />);

    await user.click(screen.getByRole('tab', { name: 'Attribute' }));
    const names = [...document.querySelectorAll('[data-datatype-property]')].map((element) =>
      element.getAttribute('data-datatype-property'),
    );
    expect(names).toEqual(['make', 'year']);
    expect(poolRow('year')).toHaveTextContent('xsd:integer');
    expect(poolRow('make')).toHaveTextContent('1×');
  });

  it('carries the property id in the drag payload so a class can receive it', async () => {
    const user = userEvent.setup();
    const car = store().createClass({ localName: 'Car' });
    const price = store().createAttributeOn(car, { localName: 'price', range: 'decimal' });
    render(<HierarchyTree />);
    await user.click(screen.getByRole('tab', { name: 'Attribute' }));

    const payloads: Record<string, string> = {};
    fireEvent.dragStart(poolRow('price') as HTMLElement, dragData(payloads));

    expect(payloads[DRAG_MIME]).toBe(
      encodeDragPayload({ kind: 'existingAttribute', propertyId: price }),
    );
  });

  it('deletes the selected property', async () => {
    const user = userEvent.setup();
    const car = store().createClass({ localName: 'Car' });
    store().createAttributeOn(car, { localName: 'price', range: 'decimal' });
    render(<HierarchyTree />);
    await user.click(screen.getByRole('tab', { name: 'Attribute' }));

    await user.click(poolRow('price') as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Delete attribute' }));
    expect(ontology().attributes).toHaveLength(0);
    expect(ontology().usages).toHaveLength(0);
  });

  it('explains itself when there are no attributes yet', async () => {
    const user = userEvent.setup();
    render(<HierarchyTree />);
    await user.click(screen.getByRole('tab', { name: 'Attribute' }));
    expect(screen.getByText(/No attributes yet/i)).toBeInTheDocument();
  });
});
