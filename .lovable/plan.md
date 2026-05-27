# Quottr: Necessity Roadmap

Each item is one shippable change. We do them in order, one at a time, and only move on when the previous one is confirmed working in preview.

---

## Phase 1 — Stop the bleeding (small, fast, high signal)

### Step 1. Fix vendor error leaks
Three server functions throw raw Stripe/Anthropic error text to the client. Replace with generic messages, keep details in `console.error`.

- `src/lib/ai-capture-quote.functions.ts` — Anthropic error
- `src/lib/connect.functions.ts` — Stripe error
- `src/lib/subscription.functions.ts` — Stripe error
- `src/lib/payments.functions.ts` — Stripe error

### Step 2. Banner audit on `/app` first run
Stack check: Stripe-connect banner + trial banner + first-run tooltip can pile up on top of the mic. Suppress trial/connect banners when `firstRun=1` is active, or collapse them into one slim row. Goal: mic is the first thing visible.

### Step 3. Hide "Existing customer" when client list is empty
In `/quotes/new` customer picker, render only "New customer" until the user has ≥1 saved client. Removes a meaningless choice for first-time users.

---

## Phase 2 — Make the AI draft review-ready (the core promise)

### Step 4. Tap-to-edit line items inline
On `/quotes/$quoteId`, every line item (description, qty, price) becomes tap-to-edit in place. No modal, no save button, no form. Tap → input appears → blur saves. This is the single biggest unlock — even a 70%-accurate draft feels fast if editing is one tap.

### Step 5. One-tap "+ Add line"
A persistent `+ Add line` row at the bottom of the items list. Opens a single text input. AI suggests price from `user_pricing_patterns` once they've typed 3+ characters. Enter to commit.

### Step 6. Trade-specific AI prompt tuning
Split the AI prompt by `trade_type` (Plumber, Electrician, Builder, Roofer, Carpenter, Decorator, Gas Engineer). Each gets its own system prompt with vocabulary, typical line items, and pricing conventions. Lives in `src/lib/ai-quote.functions.ts`.

### Step 7. Pricing patterns actually feed the draft
Currently we save patterns but I need to verify they're being read back into new quote generation. Audit `pricing-patterns.functions.ts` → confirm last 5 quotes for the same line item description influence the suggested price. Fix if not.

### Step 8. Voice resilience
- Show progress during the 8-second generation, not a blank screen
- If AI errors, preserve the transcript and drop user into manual edit with the text pre-filled (not a red toast and lost work)
- Retry button if generation fails

---

## Phase 3 — Close the loop (knowing the work is done)

### Step 9. Post-send success state
After a quote is sent, show a confirmation screen that teaches the next feature: "Sent to [name]. We'll chase on day 7 if they don't reply — see Chaser." Single primary action: "Done" → back to home. Removes the dead-end after the most important action in the app.

### Step 10. Push notifications on accept / paid
Wire `push_subscriptions` + `web-push.server.ts` to fire on:
- Quote accepted (customer hits Accept on portal)
- Payment received (Stripe webhook)
Without these, traders keep checking the app manually = friction. Includes the prompt-to-enable-notifications moment after first quote send.

### Step 11. Unmissable home-screen status
On `/app`, show today's actionable counts above the mic: "2 accepted · 1 awaiting payment · 1 overdue." Tap any → filtered quotes list. This is the at-a-glance check that replaces opening the app and hunting.

---

## Phase 4 — Get paid inside Quottr

### Step 12. Apple Pay / Google Pay on customer portal
On `/portal/$token`, enable wallet pay in the Stripe payment element. One-tap pay on iOS/Android. Card form stays as fallback. This is what turns the portal from a quote viewer into a payment terminal.

### Step 13. Chaser escalation tone
Current chaser sends the same message. Make it escalate:
- Day 7: friendly nudge
- Day 14: firmer reminder with consequences
- Day 21: final notice before action

And add a one-tap "Pause chasing" on the quote detail for when the trader has spoken to the customer offline.

### Step 14. On-paid receipt
Customer gets an automatic email + on-screen confirmation when payment clears. Stops "did it go through?" calls back to the trader.

---

## Phase 5 — Lock-in (repeat work is where trades make money)

### Step 15. "Quote again for this customer"
From `/clients/$clientId`, one-tap "New quote for [name]" that pre-fills customer details and opens the voice flow. By quote #5 with the same customer, this should be ~3 taps total.

### Step 16. Service history on customer detail
Show last 3 jobs, total billed, last paid date on `/clients/$clientId`. Lets traders see at a glance "I quoted Mrs Jones £85 for a boiler service in March."

---

## Phase 6 — Site-proof the headline feature

### Step 17. Works on 3G
Audit bundle size on `/app` and `/quotes/new`. Aim for first interactive under 3s on simulated 3G. Lazy-load anything not needed for the mic flow.

### Step 18. PWA polish
Verify install prompt fires correctly, app icon is sharp, splash screen branded. Confirm it opens like a native app from the home screen, not a browser tab.

---

## What's intentionally NOT on this list

- Multi-user/team features
- Analytics dashboards for the trader
- Marketing site polish
- Custom branding beyond logo + colour
- Welcome route refactor (200ms isn't worth touching auth)
- AI model picker / multiple providers
- Onboarding intro screen merge (nice-to-have, not necessity)

---

## How we'll work through this

One step per turn. After each step:
1. I make the change
2. You test in preview
3. You confirm or push back
4. We move to the next

We start with **Step 1 (vendor error leaks)** because it's a 10-minute change that closes two security findings and removes "Stripe /subscriptions failed" style messages users might see today.

Ready to start with Step 1, or want to reorder anything first?