# Phase 7 — route editor player check

This editor was added after the user's successful test of previous logistics
features. The player reported the required destination was too restrictive;
the open-end correction below still needs a follow-up play-test. The game is
session-only.

1. Place a Storage Container and Receiving Terminal several cells apart, with a
   clear, supported space between the container's yellow output and the terminal.
   In Q select **Conveyor**, then press **T** for route mode. Aim at the first
   *empty ground cell* touching the storage output and click. A green preview
   indicates a valid start; red and the status explain a rejected one.
2. Aim farther along the intended route and click to add one or more optional
   intermediate points. Walk if necessary; each aimed point must be within reach.
   **R** toggles the bend order for all legs. **Backspace** removes the last
   saved point. Aim at any free final cell, or at a cell immediately beside a
   compatible input and pointing into it. Green means a valid whole route; the
   status distinguishes an open end from a connected one. An incompatible
   building directly ahead is reported as blocked.
3. Check the cell count and total stone/wood cost. Press **Enter** while aiming
   at the endpoint: the whole route appears and the full cost is deducted once.
   Creative mode makes it free. Put items in the storage with E and confirm they
   travel to the terminal, including around bends and under backpressure.
4. With a source disabled or empty, build a route ending in empty space. Begin
   another route in the free cell directly ahead of its last belt and confirm;
   repeat up to 24 cells per route. Place the receiving machine afterwards and
   then supply items, verifying the complete line. Test with active items too.
   **Warning:** an open end drops arriving items onto the ground; connect the
   destination or stop the source first if you do not want that behavior.
5. Try insufficient resources, an obstacle/player in the path, a missing or
   occupied starting output, a non-input building directly ahead, and a route
   over 24 cells. Enter must not build a partial route or spend materials. With a running line, try
   changes while items travel; protected topology changes must be refused safely.
6. Try cancellation with **Esc** or **Q**, return to one-cell placement with
   **T**, and verify neither action builds the unfinished route. Try splitter,
   merger, processor and lift ports, as well as an existing one-cell conveyor.

Limits: orthogonal grid paths, maximum 24 cells per confirmation; the starting
output must already exist. The final destination may be placed afterwards.
The 250 ms advisory preview may briefly lag moving items, but Enter rechecks.
Red fallback geometry may not reflect exact foundation height. The ordinary
terrain-aiming and support restrictions apply. Legacy two-cell belts cannot be
endpoints; lift heights outside 1–8 m or below 0.1 m precision and saved games are not implemented.
