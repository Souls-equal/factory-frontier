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
2. Find deposits, aim until the gathering prompt appears and press E repeatedly
   (5 items per press). From spawn facing the beacon, the first iron deposit is
   approximately 7 m left
   and 1 m behind (with up to 1 m jitter); look for its pale blue aura and blue
   ground markings. Other resources have different marker colours; explore for
   stone and wood deposits. Confirm markers are visible on slopes as well as flat
   ground. Gather at least **20 iron ore, 30 stone and 20 wood** for
   one Miner, straight, right curve, incline and terminal. Expect Tab inventory
   to show the gathered quantities. Gather extra for experiments. For the partial
   retrieval test below, gather at least 115 iron and 50 stone before building,
   and merge the remaining iron into one stack after paying for the Miner.

## Voxel terrain checks (integration pending physical acceptance)

- On the default world, travel beyond the starting clearing to a one-block ledge.
  Walk into its vertical face: expect to stop without passing through or rising.
  Jump while moving towards it: expect to land on top, then walk down without
  falling through the ground. Repeat along an edge, at corners and near a rock.
- Place a foundation on a flat top; attempt to place one across a height change.
  The latter should be rejected without charging resources. Check deposits and
  the factory chain below still work. Record any visual/collision mismatch.
- Terrain cannot be broken. The new tree/branch/loose-stone bootstrap and voxel
  machine models are not implemented yet; the previous resource loop is interim.

## Construct and connect

3. Q → Miner Mk.1. Aim at the iron deposit from nearby ground; the preview must
   say valid and identify a usable spot. Use the default rotation (do not press R)
   and C to place. Expect one Miner and a deduction of 20 iron, 10 stone, 10 wood.
   Escape exits placement; press E while targeting it: expect its deposit purity,
   output and running state.
4. Q → Conveyor: Straight. Each logistics building costs 4 stone and 2 wood.
   Starting at the Miner's **yellow output**, aim at the adjacent 2 m footprint
   ahead of it. Default orientation flows from rear to front. Preview should say
   connected and valid; C places. All building types stay selected for repeat
   placement; Escape cancels (also before interacting or demolishing). A cyan
   marker is the input and yellow is the output on the placed model. Expect the belt cyan input to meet the Miner yellow output.
5. Escape to exit repeat-placement, then Q → Conveyor: Right Curve. Place it immediately after the straight belt in
   the same orientation; expect its cyan inlet to meet the straight yellow outlet
   and its yellow outlet to turn right relative to travel. Escape, then Q → Conveyor: Incline;
   rotate with R until its cyan inlet meets the curve outlet, then C. Its outlet
   should be one metre higher. Escape, then Q → Receiving Terminal; rotate until its cyan inlet
   meets the incline yellow outlet and place. Expect each preview to report a
   connected port and the terminal to stand at the incline's output height.
   Press Escape to exit placement before inspecting it.
   Default zero-rotation Miner/straight/curve with three R presses for the incline
   and terminal is a geometry-tested arrangement on the starting deposit. If
   terrain, obstacles, aim or collision prevent this in practice, record the failure.
6. Try a reversed adjacent belt and an overlapping footprint. Expect an explanatory
   invalid preview and no inventory deduction after C. Test an isolated belt:
   its preview reports disconnected; after placement and Escape, E inspection
   reports DISCONNECTED. Test a
   belt on a foundation and F on the supporting foundation: expect refusal until
   the belt is removed. Rotation, grid snapping, repeat placement, cancellation,
   and placement on terrain should all match the preview. Repeat placement with
   a foundation, Miner, each belt shape and terminal; confirm each successful
   placement deducts its cost, invalid or unaffordable attempts do not, and
   Escape clears the preview before E/F interactions.

## Run, inspect and recover

7. Leave menus closed and watch the full chain. Expect individual ore items to
   move from the Miner, through the straight, right curve and incline, into the
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
    other 23 inventory slots occupied. With at least 23 stone/wood left after
    construction, Tab → select a stack → Split repeatedly to occupy spare slots;
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
    items are on a belt should freeze them; replace it with a matching orientation
    and expect those same items to resume without loss.

Record each result and any console errors/screenshots. Report separately whether
pointer lock, every shape/rotation, blockage/recovery, partial retrieval and the
complete chain passed. Do not infer acceptance from these instructions alone.
