# Phase 7 — combined logistics acceptance

The user reports that all previously playable additions work after testing.
This global report does not list individual scenario outcomes. The new route
editor was added afterwards and has its own pending check in `PHASE_7_ROUTE_CHECK.md`. Creative construction (Q) can remove building costs, but not
production inputs. State is session-only; refreshing loses the factory.

## Storage and splitter

Follow `PHASE_7_STORAGE_CHECK.md` and `PHASE_7_SPLITTER_CHECK.md`: test filling,
manual deposits and retrieval, demolition protection, three-way balanced output,
a blocked branch, all branches blocked and recovery. Connect output belts to
receivers; open belts can drop items on the ground.

Open the splitter with E. Choose **Overflow** and a preferred port: confirm it
uses that output first, then others once its belt fills. Choose **Strict priority**:
verify the other outputs do not receive new items while the preferred belt is
blocked or disconnected, and flow resumes after it clears. Return to Balanced.

## Merger and real production

1. Place a Merger (15 stone + 10 wood). Connect one one-cell input belt to each
   cyan rear/side port, facing in. Connect a one-cell output belt to the yellow
   front and a Storage Container. The merger and each port accept one belt lane.
2. Supply the inputs continuously with different items. Verify all three arrive,
   no input is permanently starved, and mixed inputs can share one line.
3. Fill the output storage, verify upstream backing up. Empty it and verify flow
   resumes. While buffered, E displays/retrieves items; demolition must be blocked
   until empty, and a full player inventory must not delete remaining items.
4. Connect iron and coal miners through the merger to the smelter, then route
   ingots to the constructor and plates to storage. Observe automatic operation.

## Lifts

1. From Q choose Lift Up 1m or Lift Up 2m (15 stone + 10 wood); R rotates it.
   Connect the cyan rear input to a one-cell belt and the yellow elevated front
   output to another belt. Put a receiver at the output. Verify visible items
   travel up and arrive. Adjacent belts snap to the port's height when possible.
2. Choose the corresponding Lift Down variant: connect its high cyan input to
   the high line and its low yellow output to a belt and receiver. Check downward
   movement, all four rotations, placement order and conservation.
3. Fill the receiver or disconnect the outgoing belt: verify the lift and input
   back up without items disappearing. Empty/reconnect and confirm flow resumes.
   A lift containing items cannot be demolished; empty it first.

Limits: heights are selected as fixed 1 or 2 grid metres when placing, not
adjustable afterwards. Terrain and foundation support limits still apply, so
some elevated layouts require a supported foundation. Connect via one-cell
belts, not direct machine ports or legacy two-cell belts. The later route editor is described in `PHASE_7_ROUTE_CHECK.md`. Check previous Phase 5
manual scenarios separately; report layout, rotation and any problems found.
