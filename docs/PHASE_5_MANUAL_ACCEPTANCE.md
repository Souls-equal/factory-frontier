# Phase 5 manual acceptance — pending

These are instructions, **not test results**. Run the current deployed build or
the branch containing the follow-up changes in a WebGL-capable desktop browser
and record browser/OS, date, pass/fail and details.
The agent ran a subset with headless Chromium 143, SwiftShader WebGL 2 and
synthetic input: resource gathering, the default chain, terminal inspection and
pause, 5-of-9 partial retrieval, full-terminal blockage, terminal demolition
refusal and recovery. A separate run checked construction-menu pointer-lock
release/restore. This is not physical user acceptance; see `PROJECT_STATUS.md`
for the user's partial results and the remaining checks. That earlier build logged a Three.js PCFSoftShadowMap fallback
warning; the follow-up selects the supported PCF mode and needs browser rechecking.
No save system exists: a reload resets all construction and inventory.

## Launch and controls

1. Check out the current build, run `npm ci` then `npm run dev -- --host 0.0.0.0`;
   open the Vite URL in a WebGL-capable browser (or use the agent's live preview).
   Expect a rendered world with no fatal overlay. Check the browser console for
   errors. Click the canvas for pointer lock; if denied, drag to look. WASD moves,
   Shift sprints, Space jumps, E interacts, Tab opens inventory, Q opens
   construction. Close panels with Escape or their Close button.
2. Near spawn, look down for small block-shaped branches and pale stones; aim
   until their prompt appears and press E once each. Trees take three distinct E
   presses and give wood. Expect 5 wood per branch, 5 stone per stone and 20 wood
   per tree; collected objects disappear. Check Tab shows the quantities. With a
   full inventory, expect the object and remaining contents to stay. Trees block
   movement until collected; loose objects block placement but not movement.
   Collect at least **26 stone and 18 wood** for the Miner and four logistics
   buildings. The finite starting supply can be exhausted; place a Miner on stone
   or wood deposits for more. Deposits can be inspected with E but no longer yield
   items directly. From spawn facing the beacon, the first iron deposit is
   approximately 7 m left and 1 m behind (up to 1 m jitter); look for its pale
   blue aura and blue ground markings. Other resources have different colours.
   Confirm markers are visible on slopes as well as flat ground.

## Voxel terrain checks (integration pending physical acceptance)

- Check the brighter sky, terrain and conveyor rails/treads for legibility in a
  real WebGL browser; record glare, excessive saturation or unreadable markers.
- On the default world, travel beyond the starting clearing to a one-block ledge.
  Walk into its vertical face: expect to stop without passing through or rising.
  Jump while moving towards it: expect to land on top, then walk down without
  falling through the ground. Repeat along an edge, at corners and near a rock.
- Place a foundation on a flat top; attempt to place one across a height change.
  The latter should be rejected without charging resources. Check deposits and
  the factory chain below still work. Record any visual/collision mismatch.
- Terrain cannot be broken. Check block-shaped deposits, rocks, props, Miner,
  foundations and terminal. Conveyor surfaces remain angled where they follow a
  curve or incline; circular auras/highlights are indicators, not terrain blocks.
  Natural rock collision remains cylindrical and may differ from box corners.
- Aim at several gisements: expect distinct persistent resource colours, auras
  and ground marks, plus a separate targeting highlight. Inspect each building's
  valid and invalid previews, all four rotations and its colour/state indicators;
  check ports remain visible and match the moving items. Record discrepancies.

## Construct and connect

3. Q → Miner Mk.1. Aim at the iron deposit from nearby ground; the preview must
   say valid and identify a usable spot. Use the default rotation (do not press R)
   and C to place. Expect one Miner and a deduction of 10 stone and 10 wood, with no iron required.
   Escape exits placement; press E while targeting it: expect its deposit purity,
   output and running state.
4. Q → Conveyor. Each belt occupies exactly one grid square and costs 4 stone
   and 2 wood. Aim beside the Miner's yellow output; each half of its two-cell
   edge has an available lane. The green preview faces the camera's horizontal
   direction, yellow is the output, R adds a quarter turn, C places and Escape
   cancels. Check all four directions and that the mesh stays within the square.
5. Aim each belt's yellow output at the next square. Place a perpendicular belt
   there and verify ore changes direction onto it; repeat on both sides, with
   production already running and with a reverse-facing belt. Opposite belts can
   form a cycle: check no ore disappears. Build several turns and route the last
   belt to a matching Receiving Terminal. A full or incompatible machine blocks.
6. Leave an output with nothing in front: ore should fall, remain visible on the
   ground and be collectable with E. With a full inventory it must remain. Try
   several inputs joining a belt and check resource conservation. Test foundation
   support, blocked output, repeated placement, overlap and cancellation. Build
   ascending and descending one-cell steps in all four directions, with straight,
   side and opposite-facing destinations; the green neighbour preview must show
   the proposed ramps. Watch items follow the ramp without a height jump; terrain
   steps over one grid cell or unsafe reconfigurations must be refused.

Before running the chain, place a conveyor as close as allowed beside the player,
including near corners and next to another belt. Walk away and along it: the player
must not become stuck, teleport, or pass through solid buildings. Repeat after
jumping beside a belt and report the terrain and exact position if blocked.

## Run, inspect and recover

7. Leave menus closed and watch the full chain. Expect individual ore items to
   move from the Miner through directional tiles, turns and ramps into the terminal;
   record any visible jumps, overlap or disappearing items. E on a
   moving ore item should pick it up without opening a conveyor panel. With a full
   inventory it should remain on the belt. E on the terminal should show iron and
   its single-slot capacity as an inventory-style slot. Select it to inspect the
   stack, then use Retrieve contents; the slot should update and retain any amount
   that does not fit. Try feeding both lanes on each of its four cyan-marked
   sides, with the terminal placed before and after the belt. Observe the turn
   skin and opened side rail for left/right and multi-input turns, including ramps.
8. With a gameplay panel open, wait and try WASD, Q, C and F. Expect player
   motion, placement/demolition, Miner output and belt positions to remain unchanged.
   Close the panel: expect gameplay and transport to resume. Check pointer-lock
   restoration; if denied, click the canvas again or use drag-look.
9. Let the one-slot terminal reach **100 iron** without retrieving it (this takes
   several minutes at normal/impure purity; menus must be closed). Expect the last
   segment and eventually upstream belts to stop and report BLOCKED. F on an
   occupied belt, nonempty terminal, or Miner with output should refuse removal;
   verify no resources vanish. Disabling the Miner via E stops new extraction and
   source transfers; re-enabling resumes them.
10. For partial retrieval, ensure the player has one iron stack below 100 and all
    other 23 inventory slots occupied. After acquiring at least 23 stone/wood (a Miner on a matching deposit can replenish them), Tab → select a stack → Split repeatedly to occupy spare slots;
    merge iron stacks by dragging first if needed. Leave, for example, 95 iron in
    the sole iron stack. With more than five iron in the terminal, E → Retrieve
    contents should report 5 transferred and the exact remainder; inventory should
    show 100 iron and the terminal should retain the rest. If exact counts differ,
    use the actual remaining stack space to calculate the expected partial amount.
11. Merge two compatible partial stone/wood stacks to free a player slot, retrieve
    terminal contents, then close the panel. Expect belt flow to resume and items
    to reach the terminal again. Disable the Miner and empty its output, drain the
    terminal and wait for belts to empty before F-demolishing each building; expect
    the original cost refunded only when it fits. Removing an empty terminal lets remaining items fall at the open end;
    replace it with a matching orientation and expect new deliveries to resume.
    Check already dropped items remain on the ground.

Record each result and any console errors/screenshots. Report separately whether
pointer lock, every shape/rotation, blockage/recovery, partial retrieval and the
complete chain passed. Do not infer acceptance from these instructions alone.

The one-cell directional conveyor requires physical validation; use the scenarios above.
