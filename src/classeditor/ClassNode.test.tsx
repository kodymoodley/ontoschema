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

  it('focuses when an attribute row is double-clicked', async () => {
    const user = userEvent.setup();
    const car = seed();
    renderNode(car);

    await user.dblClick(screen.getByText('make'));
    expect(store().focusRequest).toBe(car);
  });

  it('renames rather than focusing when the header is double-clicked', async () => {
    const user = userEvent.setup();
    const car = seed();
    renderNode(car);

    await user.dblClick(screen.getByTitle('Car'));

    // The header keeps the rename gesture and stops it reaching the node.
    expect(screen.getByLabelText('Class name')).toBeInTheDocument();
    expect(store().focusRequest).toBeNull();
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
