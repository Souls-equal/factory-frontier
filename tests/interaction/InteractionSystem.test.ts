import { describe, expect, it } from 'vitest';

import type { CameraView } from '../../src/engine/types';
import type { Interactable } from '../../src/interaction/Interactable';
import { InteractionSystem } from '../../src/interaction/InteractionSystem';
import { forwardVector, raySphereIntersection } from '../../src/interaction/raycast';
import { SurveyBeacon, RelayMast } from '../../src/interaction/WorldInteractables';
import { createGameConfig } from '../../src/core/Configuration';
import { createWorld } from '../../src/world/World';
import type { InteractableDefinition } from '../../src/world/World';

function definition(overrides: Partial<InteractableDefinition> = {}): InteractableDefinition {
  return {
    id: 'test-target',
    kind: 'survey-beacon',
    displayName: 'Test Target',
    hint: 'Use it',
    x: 0,
    y: 1.5,
    z: -3,
    baseY: 0,
    range: 4,
    targetRadius: 0.6,
    ...overrides,
  };
}

function view(overrides: Partial<CameraView> = {}): CameraView {
  return {
    position: { x: 0, y: 1.7, z: 0 },
    yaw: 0,
    pitch: 0,
    ...overrides,
  };
}

function createSystem(initialView: CameraView = view(), range = 5) {
  let current = initialView;
  const system = new InteractionSystem({ range, viewProvider: () => current });
  return {
    system,
    look(next: CameraView) {
      current = next;
    },
  };
}

/** Interactable stub with controllable availability and call counting. */
function stubInteractable(overrides: Partial<InteractableDefinition> = {}): Interactable & {
  calls: number;
  setAvailable(value: boolean): void;
} {
  const descriptor = definition(overrides);
  let available = true;
  let calls = 0;

  return {
    descriptor: Object.freeze({
      id: descriptor.id,
      displayName: descriptor.displayName,
      hint: descriptor.hint,
      position: Object.freeze({ x: descriptor.x, y: descriptor.y, z: descriptor.z }),
      targetRadius: descriptor.targetRadius,
      range: descriptor.range,
    }),
    isAvailable: () => available,
    interact: () => {
      calls += 1;
      return { ok: true, message: `used ${descriptor.id}` };
    },
    get calls() {
      return calls;
    },
    setAvailable(value: boolean) {
      available = value;
    },
  };
}

describe('raycast maths', () => {
  it('finds the nearest sphere intersection', () => {
    const hit = raySphereIntersection(
      { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 } },
      { x: 0, y: 0, z: -5 },
      1,
    );

    expect(hit).toBeCloseTo(4, 6);
  });

  it('returns null when the ray misses', () => {
    const hit = raySphereIntersection(
      { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 } },
      { x: 5, y: 0, z: -5 },
      1,
    );

    expect(hit).toBeNull();
  });

  it('reports a zero distance when the origin is inside the sphere', () => {
    const hit = raySphereIntersection(
      { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 } },
      { x: 0, y: 0, z: -0.2 },
      1,
    );

    expect(hit).toBe(0);
  });

  it('builds a forward vector that follows yaw and pitch', () => {
    const forward = forwardVector(0, 0);
    expect(forward.x).toBeCloseTo(0, 6);
    expect(forward.z).toBeCloseTo(-1, 6);

    const up = forwardVector(0, Math.PI / 2);
    expect(up.y).toBeCloseTo(1, 6);

    const right = forwardVector(-Math.PI / 2, 0);
    expect(right.x).toBeCloseTo(1, 6);
  });
});

describe('InteractionSystem targeting', () => {
  it('detects an interactable in front of the camera', () => {
    const { system } = createSystem();
    system.register(stubInteractable());

    const target = system.refreshTarget();

    expect(target?.id).toBe('test-target');
    expect(target?.displayName).toBe('Test Target');
    expect(target?.distance).toBeCloseTo(2.4, 1);
  });

  it('ignores objects behind the camera', () => {
    const { system } = createSystem(view({ yaw: Math.PI }));
    system.register(stubInteractable());

    expect(system.refreshTarget()).toBeNull();
  });

  it('ignores targets outside the interaction range', () => {
    const { system } = createSystem(view(), 1.5);
    system.register(stubInteractable());

    expect(system.refreshTarget()).toBeNull();
  });

  it('honours a per-object range shorter than the global range', () => {
    const { system } = createSystem(view(), 20);
    system.register(stubInteractable({ range: 1 }));

    expect(system.refreshTarget()).toBeNull();
  });

  it('selects the closest of several targets', () => {
    const { system } = createSystem();
    system.register(stubInteractable({ id: 'far', displayName: 'Far', z: -8, range: 20, y: 1.5 }));
    system.register(stubInteractable({ id: 'near', displayName: 'Near', z: -2 }));

    expect(system.refreshTarget()?.id).toBe('near');
  });

  it('updates the target when the camera looks away', () => {
    const viewRef = { current: view() };
    const system = new InteractionSystem({ range: 5, viewProvider: () => viewRef.current });
    system.register(stubInteractable());

    expect(system.refreshTarget()?.id).toBe('test-target');

    viewRef.current = view({ yaw: Math.PI });
    expect(system.refreshTarget()).toBeNull();
    expect(system.target).toBeNull();
  });

  it('retargets when the camera turns towards another object', () => {
    const viewRef = { current: view() };
    const system = new InteractionSystem({ range: 8, viewProvider: () => viewRef.current });
    system.register(stubInteractable({ id: 'front', z: -3 }));
    system.register(stubInteractable({ id: 'right', x: -3, z: 0 }));

    expect(system.refreshTarget()?.id).toBe('front');

    // yaw = -PI/2 looks toward +X; use the mirrored angle to look toward -X.
    viewRef.current = view({ yaw: Math.PI / 2 });
    expect(system.refreshTarget()?.id).toBe('right');
  });

  it('ignores unavailable interactables', () => {
    const { system } = createSystem();
    const target = stubInteractable();
    system.register(target);
    target.setAvailable(false);

    expect(system.refreshTarget()).toBeNull();

    target.setAvailable(true);
    expect(system.refreshTarget()?.id).toBe('test-target');
  });

  it('has no target when nothing is registered', () => {
    const { system } = createSystem();

    expect(system.size).toBe(0);
    expect(system.refreshTarget()).toBeNull();
  });
});

describe('InteractionSystem execution', () => {
  it('executes the targeted interactable once per request', () => {
    const { system } = createSystem();
    const target = stubInteractable();
    system.register(target);

    system.requestInteraction();
    system.fixedUpdate(50);

    expect(target.calls).toBe(1);
    expect(system.lastOutcome).toEqual({ ok: true, message: 'used test-target' });
    expect(system.outcomeSequence).toBe(1);
    expect(system.executions).toBe(1);

    // No new request: the next steps must not re-execute.
    system.fixedUpdate(50);
    system.fixedUpdate(50);
    expect(target.calls).toBe(1);
  });

  it('consumes the request even without a target', () => {
    const { system } = createSystem(view({ yaw: Math.PI }));
    const target = stubInteractable();
    system.register(target);

    system.requestInteraction();
    expect(system.hasPendingRequest).toBe(true);
    system.fixedUpdate(50);

    expect(system.hasPendingRequest).toBe(false);
    expect(target.calls).toBe(0);
    expect(system.lastOutcome).toBeNull();
  });

  it('does not execute an interactable that became unavailable', () => {
    const { system } = createSystem();
    const target = stubInteractable();
    system.register(target);

    system.refreshTarget();
    target.setAvailable(false);
    system.requestInteraction();
    system.fixedUpdate(50);

    expect(target.calls).toBe(0);
    expect(system.target).toBeNull();
  });

  it('rejects duplicate ids and supports unregistration', () => {
    const { system } = createSystem();
    system.register(stubInteractable());

    expect(() => system.register(stubInteractable())).toThrow(/already registered/);

    const unregister = system.register(stubInteractable({ id: 'second', z: -2 }));
    expect(system.size).toBe(2);
    unregister();
    unregister();
    expect(system.size).toBe(1);
  });

  it('rejects an empty id and an invalid range', () => {
    const { system } = createSystem();
    expect(() => system.register(stubInteractable({ id: ' ' }))).toThrow(/must not be empty/);
    expect(() => new InteractionSystem({ range: 0, viewProvider: () => view() })).toThrow(RangeError);
  });
});

describe('world interactables', () => {
  const config = createGameConfig({ world: { resolution: 24, obstacleCount: 6, sizeMeters: 80 } });

  it('wires the world definitions into working interactables', () => {
    const world = createWorld(config);
    const system = new InteractionSystem({ range: config.interaction.range, viewProvider: () => view() });
    const [first] = world.interactables;
    if (first === undefined) {
      throw new Error('World provides no interactables.');
    }

    const beacon = new SurveyBeacon(first);
    system.register(beacon);

    // Aim at the beacon from just in front of it.
    const aim = {
      position: { x: first.x, y: first.y, z: first.z + 2 },
      yaw: 0,
      pitch: 0,
    };
    const aimingSystem = new InteractionSystem({
      range: config.interaction.range,
      viewProvider: () => aim,
    });
    aimingSystem.register(beacon);

    expect(aimingSystem.refreshTarget()?.id).toBe(first.id);

    aimingSystem.requestInteraction();
    aimingSystem.fixedUpdate(50);

    expect(beacon.state.pings).toBe(1);
    expect(aimingSystem.lastOutcome?.message).toContain('Survey ping');
  });

  it('cycles relay channels on each interaction', () => {
    const world = createWorld(config);
    const relayDefinition = world.interactables.find((entry) => entry.kind === 'relay-mast');
    if (relayDefinition === undefined) {
      throw new Error('World provides no relay mast.');
    }

    const relay = new RelayMast(relayDefinition);
    expect(relay.activeChannel).toBe(1);
    relay.interact();
    relay.interact();
    expect(relay.activeChannel).toBe(3);
    expect(relay.isAvailable()).toBe(true);
  });
});
