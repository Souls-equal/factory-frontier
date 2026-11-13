# Phase 6 — automated iron plates: manual validation

The complete chain still needs a real play session. Creative mode can remove
construction costs, but does not supply machine inputs.

1. Place one Miner on iron and another on coal; construct a Smelter, Constructor
   (15 stone and 10 wood), and Receiving Terminal. R rotates machines.
2. Route iron ore and coal via one-cell conveyor belts to the smelter's cyan rear
   side (one belt per input lane). Route its yellow front output to the cyan rear
   of the constructor, and its yellow front output to the terminal. Check belt
   direction and levels. Two-cell automatic legacy belts are not supported here.
3. Close menus and observe: 1 ore + 1 coal → 1 ingot in 2 seconds, then 1 ingot
   → 1 iron plate in 2 seconds. Check that plates reach the terminal without
   manual item transfers. The constructor needs no coal or electricity yet.
4. Inspect the constructor with E: verify recipe, input/output and progress;
   disable and re-enable it, then test manual feeding and retrieval. Nonempty
   machine buffers must prevent demolition.
5. Fill the terminal, confirm the complete line eventually backs up without lost
   items, empty it and verify production resumes. Test empty coal and re-supply.

Report unexpected behavior and which layouts were tested. Other outstanding
Phase 5 checklist items remain separate; this test does not validate power grids,
recipe selection or future machines.
