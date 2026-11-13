# Phase 7 — storage container play-test

This is a first Phase 7 slice, not acceptance of the whole phase. Session state
is not saved on refresh. The player reported success for the previous complete
iron/coal → smelter → constructor → plate chain; other older manual scenarios
are not individually confirmed.

1. Open Q, select Storage Container (15 stone + 10 wood; creative placement is
   free), place it and rotate with R. Cyan marks the rear input; yellow the front
   output. Connect the currently selectable one-cell conveyor to the cyan side.
2. Feed iron ore or plates from a running line. Open E on the container and check
   that items enter its eight slots without manual transfer. Inspect the player
   inventory, select a stack, click **Store selected stack**, then **Retrieve
   contents**. Check capacity and that any remainder stays where it was.
3. Add an outgoing conveyor at the yellow port and connect it to a receiving
   terminal. Check that stored items leave automatically. Do not leave the end
   of the output belt open unless falling ground items are intended.
4. Fill the destination and check that the output backs up. Empty it to confirm
   the line resumes. Fill the container with eight full stacks, check that the
   incoming line backs up, then retrieve items and check it resumes.
5. Check that a nonempty container cannot be demolished, then empty it and
   demolish it. Repeat connections after rotating or placing belts first.

Mixed items are emitted from the first occupied storage slot, not FIFO or sorted.
An incompatible/full destination can therefore hold up other items behind it.
The container does not automatically collect items dropped on the ground, and
legacy two-cell conveyor types are not supported. The balanced splitter is
described in `PHASE_7_SPLITTER_CHECK.md`; merger and lift checks are in
`PHASE_7_MANUAL_ACCEPTANCE.md`. Record any issue and its layout/orientation.
