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
   Before placing, use Page Up/Down for 1 m steps and Shift + Page Up/Down for
   0.1 m steps between 1 and 8 m; check the HUD, preview and repeated placement. The same controls apply to Lift Down.
   Connect the cyan rear input to a one-cell belt and the yellow elevated front
   output to another belt. Put a receiver at the output. Verify visible items
   travel up and arrive. Adjacent belts snap to the port's height when possible.
2. Choose the corresponding Lift Down variant: connect its high cyan input to
   the high line and its low yellow output to a belt and receiver. Check downward
   movement, all four rotations, placement order and conservation.
3. Fill the receiver or disconnect the outgoing belt: verify the lift and input
   back up without items disappearing. Empty/reconnect and confirm flow resumes.
   A lift containing items cannot be demolished; empty it first.

For a high test, choose 3 m and aim a foundation next to its upper port: the
preview should align its top with the lift output level (foundation base at
2.6 m when the lift base is zero). Confirm, then add a neighbouring foundation
at the same level; aim a storage container spanning both and verify it sits on
top rather than underneath. Page Up/Down still adjusts the foundation height.
Aim a one-cell belt at the platform, connect it to the output, and connect a
matching down lift back to a low receiver. Check visible movement, blockage and
recovery. Higher platforms may require reaching them from the side or building
additional platforms; the usual construction reach still applies.

Limits: heights are selected from 1–8 grid metres in 0.1 m steps before placement,
not adjustable afterwards. Terrain and foundation support limits still apply, so
some elevated layouts require a supported foundation. Compatible machine ports can connect directly when aligned at the same height;
splitters and mergers also accept directly aligned lift ports. Legacy two-cell
belts cannot connect to lifts or one-cell belts. The later route editor is described in `PHASE_7_ROUTE_CHECK.md`. Check previous Phase 5
manual scenarios separately; report layout, rotation and any problems found.


### Conveyor and lift flow inspection

1. Run a supplied belt and lift into storage; aim at each and press G. Confirm
   the state, limits, observed output count and total are plausible. E must still
   pick up belt items; close the panel before attempting this.
2. Block the output and inspect after it fills, then free it and inspect again.
   Verify the blocked state and that the total only rises for completed transfers.
3. The inspection pauses simulation. Its recent count covers up to 60 seconds of
   simulated time in one-second buckets, so it starts with partial history and
   does not age while the panel is open. Rebuilding the segment resets its total.
4. Confirm G does not open inspection through inventory or construction menus.


### Storage output filter

1. Put iron ore and coal into a Storage Container with a connected output belt
   and a receiver. Open it with E and choose Coal under Output filter. Close the
   panel and verify coal leaves while iron remains. With no coal, output waits.
2. Add more coal and verify flow resumes. Fill the destination, verify backpressure,
   then free space. Switch the filter while an item is already on the belt: that
   item still completes its trip. Inputs and manual retrieval remain available.
3. Choose Any item to restore first-occupied-slot output. A second container has
   its own setting. The selection resets after demolition or page reload.


### Direct lift-to-machine connections

1. Place a storage container and an upward lift directly adjacent: align the
   yellow storage output with the cyan lift input, with the same rotation and
   height. Place a supported receiving container directly at the lift's raised
   output, matching the port height. Either placement order should work.
2. Add items and verify the lift transfers them directly; inspect it with G.
   Fill the destination and verify blockage and recovery. Change the source
   storage's output filter and verify only the selected item leaves.
3. Repeat with a downward lift, a machine input/output and a rotated terminal.
   Wrong heights or directions must not connect. Direct links to splitters,
   mergers and other lifts are now supported; legacy belts cannot connect directly.


### Direct lift-to-splitter and merger connections

1. Connect a splitter's front and side output ports directly to correctly oriented
   upward lifts at the same height, and put supported receivers at their outputs.
   Feed the splitter and check balanced distribution. Fill one receiver: check
   overflow and strict-priority modes, then free it and verify recovery.
2. Feed a merger using direct downward lifts at its three input ports, then attach
   a direct upward lift to its output. Check that all inputs progress and no items
   disappear when the output is full or after it is emptied.
3. Try placing lifts and junctions in either order and at a supported upper level.
   Wrong height/direction must not connect. Each port permits one lane; direct
   lift-to-lift connections are now supported; legacy belt connections remain unsupported.


### Direct lift-to-lift connections

1. Place an upward lift and an adjacent downward lift in the same direction,
   matching their joined port heights. Try both placement orders and use the
   construction preview to check the connection. Connect storage at both ends.
2. Send items through, inspect each lift with G, fill the destination, then free
   space. Check items stay spaced and none disappear; occupied lifts must not be
   dismantled. Check the flow counters and dismantle the lifts after emptying.
3. Try several heights and rotations, including two ascending lifts with an
   appropriately supported upper lift, and a chain of three lifts. Wrong height
   or direction must stay disconnected; normal foundation support still applies.


### Fine lift-height adjustment

1. Select Lift Up or Down from Q. Use Page Up/Down to change the height by 1 m,
   then hold Shift while pressing the same keys to adjust by 0.1 m. Confirm the
   HUD and preview show the selected height and clamp at 1 and 8 m.
2. Place a 2.3 m lift next to an existing platform with a top 2.3 m above its
   base; connect compatible ports and send items. Try descending, rotation and
   the reverse placement order. Existing support and reach rules still apply.
3. Block and clear the receiving container, verify recovery, and check the lift
   cannot be demolished while it contains items. Adjusting a new preview must
   not resize the lift already placed.


### Splitter item filters

1. Connect a splitter to three outputs and receivers. Open it with E and choose
   **Filter by item**. Set Front to Iron Ore, Left to Coal and Right to
   **Unmatched items**. Send a mixed stream and verify each type follows its
   intended output; other items use Right. Connect belts or lifts as desired.
2. Fill or disconnect the iron output. Once its belt fills, the buffered ore
   must wait rather than escape through Right; later input may also back up.
   Clear or reconnect the output and verify recovery and conservation. Open
   belt ends can still drop items, so connect receivers before feeding.
3. Assign Coal to two outputs and verify they share delivery when both are
   available. Assign all three to items and send an unassigned type: it waits
   until an unmatched output becomes available or the configuration changes.
4. Change filters while an item is already on an output belt; it must continue
   on that belt. Switch to a different mode and back, then reopen the panel: the
   filters remain. Demolition/rebuilding or reloading resets them. Test mixed
   merger inputs feeding a filtered splitter and check separate outputs.


### Selected storage stacks

1. Place a storage container, put multiple stacks of the same item plus another
   material inside, then open it with E. Select the second stack and use
   **Retrieve selected stack**: only that stack should move. **Retrieve contents**
   still transfers everything that fits. Receiving terminals support selected
   retrieval too; they do not accept manual deposits.
2. Fill the player inventory partially or completely and try selected retrieval.
   Only what fits moves, and the remainder stays in the chosen slot. Try the
   reverse with **Store selected stack**, including two player stacks of the same
   item: only the selected slot should change.
3. While a belt feeds storage, open the panel, retrieve a selected stack and
   close it. Check transport resumes and items already on the belt arrive.
   Splitter/merger buffer retrieval and storage output filtering remain unchanged.

4. Select a stack, enter a smaller whole number in **Store quantity** or
   **Retrieve quantity**, and verify exactly that amount moves from that slot.
   Leave the field blank to transfer the whole stack. Try zero, a fraction, a
   negative number and more than the selected stack: none should transfer.
5. Reduce destination capacity below the requested quantity and verify only
   what fits moves and the remaining source-stack count is reported. Change
   selection or reopen the panel and check the field clears. Repeat selected
   retrieval at a receiving terminal; **Retrieve contents** remains independent.
   Press Escape while editing a quantity and verify the panel closes.
