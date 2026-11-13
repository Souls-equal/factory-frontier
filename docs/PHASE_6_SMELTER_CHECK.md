# Phase 6 — smelter slice: manual check

This is a focused check of the first slice, not acceptance of the complete phase.

1. Gather stone and wood, build a Miner on iron and a Smelter (15 stone, 10 wood).
   Rotate with R. Its cyan port is input at the rear, yellow is output at the front.
2. Use the one-cell Conveyor in the build menu: point a belt from the miner into
   the cyan side, and another away from the yellow side into a Receiving Terminal.
   Mine coal from a coal deposit with a second Miner. Deliver it manually through
   E → Add coal, or use a second belt into the other cyan rear input lane. Both
   lanes accept iron ore and coal; only one output belt is served. The belts and
   smelter may be placed in either order. Ensure directions and levels match.
3. Observe ore and coal enter, wait for processing (one ore + one coal → one ingot every 2 seconds),
   then inspect the terminal for ingots. E on the smelter shows buffers, state and
   progress. Menus pause the simulation, so close them while waiting.
4. Remove all coal with E → Retrieve coal; with ore present and output space
   available the state becomes NO_POWER and production stops. Add coal to resume.
   Disable/re-enable via E; manually feed or retrieve ore and coal via the panel.
   A nonempty input, fuel or output buffer prevents demolition. An open output belt
   can drop ingots on the ground, as with other one-cell conveyor ends.
5. Fill the terminal/output, confirm the line blocks without losing stock; empty
   it and confirm the line resumes. Items other than iron ore and coal must not enter the smelter.

Report results and any position/orientation that fails. The constructor, plates,
recipe selection and electrical power networks are not in this slice. Old two-cell automatic belts are
not integrated with the smelter. The rest of the Phase 5 checklist is separate.
