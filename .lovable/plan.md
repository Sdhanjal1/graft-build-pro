## Copy-only voice pass — strings I'll change

All changes are text only. No logic, layout, or component edits. Variables (`{trialDaysLeft}`, names, amounts) preserved.

### A. The 14 strings you specified


| #   | File:line                                                                           | Current                                                                                                                                         | New                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/routes/quotes.new.tsx:1451-1452`                                               | "Speak the job" / "Describe it out loud — Quottr writes the quote."                                                                             | "Speak the job. We'll write it." (single line; subtitle removed-to-blank or merged — see Q1)                                                         |
| 2   | `src/routes/onboarding.tsx` step 1 heading                                          | "7 quick questions. Then quote in seconds."                                                                                                     | "Right — let's get you quoting." (sub kept: "Set up once, then every quote takes nine seconds.")                                                     |
| 3   | `src/routes/onboarding.tsx` step 6 heading                                          | "You're ready."                                                                                                                                 | "Sorted. Go win one."                                                                                                                                |
| 4   | `src/routes/quotes.index.tsx:300-301`                                               | title "No quotes yet" / body "Tap the mic to create your first quote in seconds."                                                               | title "Nothing quoted yet." / body "Tap, talk, done."                                                                                                |
| 5   | `src/routes/clients.index.tsx:80-81`                                                | "No customers yet" / "They'll be added automatically when you create quotes, or add one manually."                                              | "No customers yet." / "They land here when you quote."                                                                                               |
| 6   | `src/routes/messages.tsx:238-239`                                                   | "No messages yet" / "When a customer replies to a quote or accepts one, it shows up here."                                                      | "All quiet." / "Replies and accepts show up here."                                                                                                   |
| 7   | `src/routes/chaser.tsx:83-84`                                                       | "Nothing to chase" / "When an invoice is sent, you can chase payment here."                                                                     | "Nothing owed. Nice." / "Sent quotes show up here."                                                                                                  |
| 8   | `src/routes/quotes.new.tsx:2549` ("Listening…" label) and `:2518` ("Listening" cue) | "Listening…"                                                                                                                                    | "Listening. Talk me through the job." (long label on the cue; short "Listening" stays in the top kicker since it's a 1-word status — flagging as Q2) |
| 9   | `src/lib/transcribe.functions.ts:78`                                                | "Didn't catch anything — try speaking a bit closer to the mic."                                                                                 | "Didn't catch that — go again."                                                                                                                      |
| 10  | `src/components/SendQuoteDialog.tsx:170`                                            | "Quote sent"                                                                                                                                    | "Gone. Now go win it."                                                                                                                               |
| 11  | `src/routes/invoices.$quoteId.tsx:240` toast                                        | "Marked as paid"                                                                                                                                | "Paid. That's in the bank."                                                                                                                          |
| 12  | `src/routes/app.tsx:355-357` Stripe nudge                                           | "Take card payments" / "Connect Stripe in 60 seconds."                                                                                          | "Take card payments." / "Get paid on the spot."                                                                                                      |
| 13  | `src/components/TrialBanner.tsx:70-72`                                              | title `${trialDaysLeft} days left in trial` / body "Add a card now — you won't be charged until your trial ends." / action "Add payment method" | title `${trialDaysLeft} days left.` / body "Add a card, keep quoting." / action "Add a card"                                                         |
| 14  | Deposit prompt — `src/lib/payment-timing.ts:14` option sub OR a banner? See Q3      | "Deposit upfront, balance on completion"                                                                                                        | "Add a deposit. Get paid before you start."                                                                                                          |


### B. Adjacent corporate-sounding copy I propose to align (same screens, copy-only)


| File:line                                                 | Current                                                                       | Proposed                                                  |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| `src/components/SendQuoteDialog.tsx:172`                  | "Sent to {name}. We'll let you know when they open it."                       | "Sent to {name}. You'll know when they open it."          |
| `src/components/TrialBanner.tsx` past_due body            | "Your last payment didn't go through. Update your card to keep using Quottr." | "Card didn't go through. Update it to keep quoting."      |
| `src/components/TrialBanner.tsx` expired title/body       | "Your trial has ended" / "Add a card to keep using Quottr — £29/month."       | "Trial's up." / "Add a card to keep quoting — £29/month." |
| `src/components/TrialBanner.tsx` warn title (1 day)       | "Trial ends tomorrow"                                                         | "Last day."                                               |
| `src/routes/quotes.index.tsx:308`                         | "Nothing here" (filtered empty)                                               | "Nothing here yet." (kept — flagging)                     |
| `src/routes/chaser.tsx:59,74` subtitle                    | "Replies & payments"                                                          | leave (already short)                                     |
| `src/lib/payments-webhook-shared.server.ts:21` push title | "Payment received 💰"                                                         | "Paid. That's in the bank. 💰"                            |


### C. Things I will NOT touch (flagging for you)

- Onboarding intermediate step headings ("What's your trade?", "Mobile number?", "VAT registered?") — already short/plain.
- Marketing/landing routes (`/`, `/about`, `/features`, `/pricing`, `/trades*`) — you said in-app only.
- Email templates (`send-invoice.server.ts`) — outbound to customers, different voice register; leave unless you say otherwise.
- Customer-facing portal pages (`portal.*.tsx`, `q.$code.tsx`) — these speak to the homeowner, not the tradesperson.
- Error messages from server functions (auth, validation) — leave unless you call them out.

### Open questions before I apply

1. **Q1 — Home voice card:** Current has a bold title + smaller subtitle. "Speak the job. We'll write it." is one phrase. Use it as the title and **drop the subtitle**, or split ("Speak the job." title / "We'll write it." subtitle)?
2. **Q2 — Voice listening:** There are two "Listening" strings — the top kicker (small uppercase, 1 word) and the bottom audio-bar caption. Apply "Listening. Talk me through the job." to **both**, or just the bottom caption (keeping the top as the 1-word status)?
3. **Q3 — Deposit prompt:** "Add a deposit. Get paid before you start." reads like a CTA banner, not a dropdown option label. Where exactly should it appear — as the description on the `deposit_then_balance` payment-timing option in the quote editor, as a new banner on the quote screen when no deposit is set, or somewhere else you have in mind?

Reply with answers to 1–3 (or "use your best judgement") and I'll apply.

Approved — including Section B. Answers:  
Q1: Split it — "Speak the job." as title, "We'll write it." as subtitle.  
Q2: Bottom caption only — full sentence there, keep the top kicker as the one-word "Listening" status.  
Q3: Use it as the description on the deposit_then_balance payment-timing option (replace the existing "Deposit upfront, balance on completion" text). No new banner.  
Apply all.