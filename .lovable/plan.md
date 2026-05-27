## Step 9 — Post-send success state teaching the chaser

Done. `SendQuoteDialog` now transitions to a "Quote sent" success state after a successful send (sms / email / wa). The state confirms delivery channel, lists the auto-chase schedule from `userProfile.chase_offsets` (Day 7 / 14 / 21 by default, labelled "Friendly nudge / Follow-up / Final reminder"), and gives a per-quote auto-chase toggle wired to `setQuoteAutoChase`. CTAs: "View chaser" → `/chaser`, or "Done" to close.

The `updatedLinkPortalCode` re-share path still closes immediately (no teaching repeat).
