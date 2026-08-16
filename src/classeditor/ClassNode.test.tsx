import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import { useProjectStore } from '../projectstore';
import { attributeUsagesOfClass, findClass, indexOntology } from '../ontologymodel';
import { schemaNodes } from '../canvas';
import { ClassNode } from './ClassNode';

const store = () => useProjectStore.getState();
const ontology = () => {
  const state = useProjectStore.getState();
  const project = state.projects.find((candidate) => candidate.id === state.activeProjectId);
  if (!project) throw new Error('no active project');
  return project.ontology;
};

/**
 * Renders the node with exactly the data the canvas would hand it, so the test cannot drift
 * from what the graph derivation actually produces.
 */
function renderNode(classId: string) {
  const node = schemaNodes(ontology()).find((candidate) => candidate.id === classId);
  if (!node) throw new Error('class not on the canvas');
  render(
    <ReactFlowProvider>
      <ClassNode
        id={node.id}
        type="ontologyClass"
        data={node.data}
        selected={false}
        dragging={false}
        draggable
        selectable
        deletable
        zIndex={0}
        isConnectable
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />
    </ReactFlowProvider>,
  );
  return node;
}

function seed() {
  const car = store().createClass({ localName: 'Car' });
  store().createAttributeOn(car, { localName: 'make', range: 'string' });
  store().createAttributeOn(car, { localName: 'year', range: 'integer' });
  store().select(null);
  return car;
}

describe('ClassNode double-click', () => {
  it('asks the canvas to focus the class when the body is double-clicked', async () => {
    const user = userEvent.setup();
    const car = seed();
    renderNode(car);

    await user.dblClick(screen.getByText('2 attributes'));

    expect(store().focusRequest).toBe(car);
    // Focusing also selects, so the inspector follows the eye.
    expect(store().selection).toEqual({ kind: 'class', id: car });
  });

  it('renames rather than focusing when an attribute row is double-clicked', async () => {
    const user = userEvent.setup();
    const car = seed();
    renderNode(car);

    await user.dblClick(screen.getByText('make'));

    expect(screen.getByLabelText('Attribute name')).toHaveValue('make');
    // The row owns this gesture. Letting it reach the node would zoom the canvas instead.
    expect(store().focusRequest).toBeNull();
  });

  it('renames rather than focusing when the name is double-clicked', async () => {
    const user = userEvent.setup();
    const car = seed();
    renderNode(car);

    await user.dblClick(screen.getByTitle('Car'));

    // The name keeps the rename gesture and stops it reaching the node.
    expect(screen.getByLabelText('Class name')).toBeInTheDocument();
    expect(store().focusRequest).toBeNull();
  });

  it('focuses rather than renaming when the header beside the name is double-clicked', async () => {
    const user = userEvent.setup();
    const car = seed();
    renderNode(car);

    const header = document.querySelector('header');
    expect(header).not.toBeNull();
    await user.dblClick(header as HTMLElement);

    /*
     * The gesture belongs to the name, not to the strip it sits in. Before this the whole header
     * opened the editor, which left a class with almost nowhere to aim a double-click: the header
     * renamed it, every attribute row renamed that property, and only the footer was free — a
     * share that shrank as the class grew.
     */
    expect(screen.queryByLabelText('Class name')).not.toBeInTheDocument();
    expect(store().focusRequest).toBe(car);
  });

  it('still renames from the header after a focus elsewhere on the node', async () => {
    const user = userEvent.setup();
    const car = seed();
    renderNode(car);

    await user.dblClick(screen.getByText('2 attributes'));
    store().clearFocus();
    await user.dblClick(screen.getByTitle('Car'));

    const field = screen.getByLabelText('Class name');
    await user.clear(field);
    await user.type(field, 'Automobile{Enter}');
    expect(findClass(ontology(), car)?.localName).toBe('Automobile');
  });

  it('can be asked twice, so double-clicking the same class again re-focuses it', async () => {
    const user = userEvent.setup();
    const car = seed();
    renderNode(car);

    await user.dblClick(screen.getByText('2 attributes'));
    expect(store().focusRequest).toBe(car);

    // The canvas clears the request once it has acted on it.
    store().clearFocus();
    expect(store().focusRequest).toBeNull();

    await user.dblClick(screen.getByText('2 attributes'));
    expect(store().focusRequest).toBe(car);
  });

  it('leaves the model untouched — focusing is a view change, not an edit', async () => {
    const user = userEvent.setup();
    const car = seed();
    const depth = store().history.past.length;
    renderNode(car);

    await user.dblClick(screen.getByText('2 attributes'));

    expect(store().history.past.length).toBe(depth);
    expect(attributeUsagesOfClass(ontology(), car)).toHaveLength(2);
    expect(indexOntology(ontology()).classById.has(car)).toBe(true);
  });
});

/**
 * Renaming a datatype property from inside a class box. The property lives in a shared pool, so
 * the rename reaches every class holding it — which is the part a user cannot see happening and
 * the reason the field says how far it goes.
 */
describe('renaming an attribute in place', () => {
  const nameOf = (propertyId: string) =>
    ontology().attributes.find((one) => one.id === propertyId)?.localName;

  const openRename = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.dblClick(screen.getByText(name));
    return screen.getByLabelText('Attribute name');
  };

  it('commits on Enter', async () => {
    const user = userEvent.setup();
    const car = seed();
    renderNode(car);
    const property = ontology().attributes[0]!.id;

    const field = await openRename(user, 'make');
    await user.clear(field);
    await user.type(field, 'manufacturer{Enter}');

    expect(nameOf(property)).toBe('manufacturer');
    expect(screen.queryByLabelText('Attribute name')).not.toBeInTheDocument();
  });

  it('abandons on Escape, leaving the name alone', async () => {
    const user = userEvent.setup();
    const car = seed();
    renderNode(car);
    const property = ontology().attributes[0]!.id;

    const field = await openRename(user, 'make');
    await user.clear(field);
    await user.type(field, 'manufacturer{Escape}');

    expect(nameOf(property)).toBe('make');
    expect(screen.queryByLabelText('Attribute name')).not.toBeInTheDocument();
  });

  it('flags a name the model would reject instead of reverting it', async () => {
    const user = userEvent.setup();
    const car = seed();
    renderNode(car);
    const property = ontology().attributes[0]!.id;

    const field = await openRename(user, 'make');
    await user.clear(field);

    // The field can be emptied and retyped; it just refuses to commit while it is unusable.
    expect(field).toHaveAttribute('aria-invalid', 'true');
    await user.type(field, '{Enter}');
    expect(nameOf(property)).toBe('make');
    expect(screen.getByLabelText('Attribute name')).toBeInTheDocument();

    await user.type(field, 'model{Enter}');
    expect(nameOf(property)).toBe('model');
  });

  it('opens from the keyboard with F2, so it is not a mouse-only gesture', async () => {
    const user = userEvent.setup();
    const car = seed();
    renderNode(car);

    // The rows are the first focusable things in the node, in the order they are drawn.
    await user.tab();
    await user.keyboard('{F2}');

    expect(screen.getByLabelText('Attribute name')).toHaveValue('make');
  });

  it('renames only the row that was opened', async () => {
    const user = userEvent.setup();
    const car = seed();
    renderNode(car);
    const [make, year] = ontology().attributes;

    const field = await openRename(user, 'year');
    await user.clear(field);
    await user.type(field, 'built{Enter}');

    expect(nameOf(year!.id)).toBe('built');
    expect(nameOf(make!.id)).toBe('make');
  });

  it('says nothing about other classes when the property is used only here', async () => {
    const user = userEvent.setup();
    const car = seed();
    renderNode(car);

    await openRename(user, 'make');
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });

  it('warns how far the rename reaches when the property is shared', async () => {
    const user = userEvent.setup();
    const car = seed();
    const van = store().createClass({ localName: 'Van' });
    const lorry = store().createClass({ localName: 'Lorry' });
    const make = ontology().attributes[0]!.id;
    store().attachPropertyToClass(make, van);
    store().attachPropertyToClass(make, lorry);
    renderNode(car);

    await openRename(user, 'make');
    expect(screen.getByText('↗ 2 more')).toBeInTheDocument();
  });

  it('names one other class the same way, since the marker carries the count', async () => {
    const user = userEvent.setup();
    const car = seed();
    const van = store().createClass({ localName: 'Van' });
    store().attachPropertyToClass(ontology().attributes[0]!.id, van);
    renderNode(car);

    await openRename(user, 'make');
    expect(screen.getByText('↗ 1 more')).toBeInTheDocument();
  });
});
