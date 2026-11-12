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
4. Q → Conveyor. Each logistics building costs 4 stone and 2 wood.
   Place the first tile at the Miner's **yellow output**. Its cyan input should
   meet the output regardless of the selected initial rotation. C places repeatedly;
   Escape cancels placement. An isolated tile uses R for its initial direction.
   Before adding a terminal, wait for items: they should queue at the open end,
   which should report BLOCKED, not DISCONNECTED. An unsourced line is DISCONNECTED.
5. Place more Conveyor tiles in a line and aim a new tile to either side. Before
   pressing C, expect the preceding tile to be replaced visually by a green ghost
   showing the planned turn; cyan is its input and yellow its output. Moving aim
   away or cancelling restores the actual straight tile. Partially aligned edge
   contacts may snap to a neighbour. C commits the same turn and the materials
   should follow it. A red/invalid preview must not show neighbour changes.
   Test all rotations and build some sections before attaching a Miner. Try rising
   and falling terrain or foundations: the preview, surface and moving items must
   agree. Place a Receiving Terminal facing the last output and observe transport.
   Test a single isolated tile with an adjacent tile to the left and to the right;
   the first tile should turn without having to connect a Miner first. Repeat with
   a running Miner and a belt blocked full at its open end: adding a side tile
   should immediately turn it, retain all items and resume transport. Items may
   snap to the new path at construction. If a more complex arrangement cannot
   preserve spacing, expect `conveyor occupied` and no payment. Record mismatches.
6. Try a branch, cycle, overlap or excessive height difference. Expect an invalid
   preview and no payment. Try an isolated tile, a foundation-supported tile and
   demolishing its support, as well as repeated placement and cancellation.

## Run, inspect and recover

7. Leave menus closed and watch the full chain. Expect individual ore items to
   move from the Miner, through straight tiles, turns and any slopes, into the
   terminal, without visible jumps, overlap or disappearing mid-route. E on a
   belt should show its shape, state, direction, input/output IDs, item count and
   maximum throughput. E on the terminal should show iron and its slot capacity.
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
    the original cost refunded only when it fits. Removing an empty terminal while
    items are on a source-connected belt should let them queue at its open end;
    replace it with a matching orientation and expect delivery to resume without loss.
    If the source is disconnected, expect remaining items to freeze until restored.

Record each result and any console errors/screenshots. Report separately whether
pointer lock, every shape/rotation, blockage/recovery, partial retrieval and the
complete chain passed. Do not infer acceptance from these instructions alone.

The single self-adapting conveyor requires physical validation; use the scenarios above.
