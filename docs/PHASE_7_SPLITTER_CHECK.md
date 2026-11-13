# Phase 7 — combined logistics play-test: splitter

The player requested testing the new features together later. Neither storage
nor splitter has been user-validated. This checklist complements
`PHASE_7_STORAGE_CHECK.md`. State is session-only and is lost on refresh.

1. Build a Splitter (15 stone + 10 wood, or free in creative) and rotate it with
   R. Connect one one-cell conveyor to the cyan rear input, facing into it.
   Connect one-cell conveyors pointing outward at its yellow front and two side
   ports; place exactly one lane per port. Connect all output ends to receivers
   (open belts can drop items on the ground).
2. Feed it steadily from a miner or storage container and check that all three
   outputs receive items. With all paths free, distribution should be balanced.
   Repeat with only one or two output belts, and rotate or place belts first.
3. Fill one downstream receiver: after its belt fills, check the other branches
   still receive items. Empty it and verify that it resumes receiving. Fill all
   receivers and verify the input backs up; empty one and check flow resumes.
4. With an item buffered and all outputs blocked or disconnected, use E to
   inspect and retrieve it. Verify demolition is blocked until it is empty.
   Test retrieval with a full inventory: the buffered item must remain.
5. Repeat the storage checklist and the earlier iron/coal → smelter → constructor
   chain in the same session. Report unexpected behavior and the orientations.

Only balanced automatic routing is implemented. Configurable overflow/priority,
mergers and lifts remain future Phase 7 work. Splitter ports support only the
selectable one-cell conveyors, not legacy two-cell belts. No ground-item pickup
is provided for the splitter.
