## In-app copy audit — remaining generic/corporate phrasing

Read-only scan across the screens we already touched plus Settings and quote detail. Grouped by screen. Each row: location → current → suggested rewrite. Anything I think should stay is in the "Leave" section at the bottom.

> Same rules: copy only, variables preserved, no logic/layout changes.

### Home (`src/routes/app.tsx`)


| Line    | Current                                                                                      | Suggested                                                                              |
| ------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 24-27   | "Working late" / "Good morning" / "Good afternoon" / "Good evening"                          | Leave — natural, not corporate.                                                        |
| 131     | hero label "Paid today"                                                                      | "In today" (tighter, money-focused) — optional                                         |
| 149     | hero label "You are owed"                                                                    | "You're owed" (contraction matches voice)                                              |
| 158     | hero label "Won today"                                                                       | Leave                                                                                  |
| 163     | card cta "Send reminder"                                                                     | "Chase it"                                                                             |
| 164     | card title "Quotes to send" / cta "Send now"                                                 | "Ready to send" / "Send it"                                                            |
| 165     | card title "Booked jobs" / cta "Mark complete"                                               | "Booked in" / "Mark done"                                                              |
| 166     | card title "Awaiting reply" / cta "Chase up"                                                 | "Waiting on a reply" / "Nudge them"                                                    |
| 188     | "Set up your business"                                                                       | "Finish setup"                                                                         |
| 220     | "Today's jobs"                                                                               | Leave — already plain                                                                  |
| 266-267 | first-run callout: "Welcome, {firstName}. Tap the mic to speak your first quote." / "Try: …" | "Right {firstName} — tap the mic and talk through your first job." / leave "Try:" line |
| 277     | "Got it"                                                                                     | Leave                                                                                  |
| 291     | "Tap to start"                                                                               | Leave                                                                                  |
| 293     | "New voice quote"                                                                            | "Speak a new quote"                                                                    |
| 306     | "Try saying"                                                                                 | Leave                                                                                  |
| 314     | "Or type instead"                                                                            | Leave                                                                                  |
| 332     | "Materials needed"                                                                           | "Need to pick up"                                                                      |


### Quotes list (`src/routes/quotes.index.tsx`)


| Line     | Current                                              | Suggested                          |
| -------- | ---------------------------------------------------- | ---------------------------------- |
| 48       | tile label "Awaiting payment"                        | "Waiting to be paid"               |
| 140      | tile pill "Awaiting"                                 | Leave (too short to gain anything) |
| 302      | empty cta "New quote"                                | "Speak a new quote"                |
| 308      | filtered empty title "Nothing here"                  | "Nothing matches."                 |
| 354      | toast "Chaser opened in WhatsApp"                    | "Chaser sent to WhatsApp"          |
| 367, 410 | toast "Quote deleted"                                | "Quote binned"                     |
| 369, 369 | "Couldn't delete quote" / "Couldn't complete action" | Leave — error tone fine            |
| 404      | "Quote duplicated"                                   | "Copied. Edit and send."           |
| 407      | "Marked as sent"                                     | "Marked sent"                      |


### Quote detail (`src/routes/quotes.$quoteId.tsx`)


| Line | Current                                       | Suggested                     |
| ---- | --------------------------------------------- | ----------------------------- |
| 292  | toast "Quote accepted"                        | "Accepted. Get on it."        |
| 302  | "Marked as sent"                              | "Marked sent"                 |
| 311  | "Quote declined"                              | "Marked declined"             |
| 323  | "Deposit removed"                             | Leave                         |
| 334  | "Marked as unpaid"                            | "Marked unpaid"               |
| 369  | "Quote deleted"                               | "Quote binned"                |
| 484  | "Quote PDF downloaded"                        | "PDF saved"                   |
| 495  | "Job marked complete — ready to take payment" | "Job done. Time to get paid." |
| 565  | primary action label "Mark as paid"           | "Mark paid"                   |
| 817  | "View as customer"                            | Leave                         |
| 818  | "Download PDF"                                | Leave                         |
| 819  | "Email customer"                              | Leave                         |
| 820  | "Call customer"                               | Leave                         |
| 822  | "Send chaser on WhatsApp"                     | "Chase on WhatsApp"           |
| 829  | "View final invoice"                          | Leave                         |
| 832  | group label "Payments"                        | Leave                         |
| 834  | "Mark as paid"                                | "Mark paid"                   |
| 837  | "Mark as unpaid"                              | "Mark unpaid"                 |
| 848  | "Remove recorded deposit"                     | "Remove deposit"              |
| 851  | "Request payment (send link)"                 | "Send a payment link"         |
| 854  | "Take payment on site"                        | "Take payment now"            |
| 877  | "Duplicate quote"                             | "Copy quote"                  |
| 879  | "Mark as sent"                                | "Mark sent"                   |
| 882  | "Mark as declined"                            | "Mark declined"               |
| 886  | "Delete quote"                                | Leave                         |
| 662  | "Customer declined this quote."               | "Customer said no."           |


### New/Edit quote (`src/routes/quotes.new.tsx`)


| Line          | Current                                                                                                                                | Suggested                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 405, 411, 416 | "Couldn't reach Quottr's AI — refresh and sign in again." / "Couldn't reach the AI — check your signal, or type the job instead." (×2) | Leave the first; tighten the other two to: "Can't reach the AI — check your signal, or type the job." |
| 828           | "Couldn't start the mic — try again, or type the job below."                                                                           | "Mic didn't start. Try again, or type the job."                                                       |
| 1281          | toast "Changes saved" / "Quote saved"                                                                                                  | Leave                                                                                                 |
| 1285          | "Draft updated"                                                                                                                        | Leave                                                                                                 |
| 1288          | "Saved as draft"                                                                                                                       | Leave                                                                                                 |
| 1297          | "Could not save changes" / "Could not save quote"                                                                                      | Leave                                                                                                 |
| 1367          | PageHeader title "Edit quote" / "New quote"                                                                                            | Leave                                                                                                 |
| 1398          | "Add a customer to save this quote."                                                                                                   | "Add a customer first."                                                                               |
| 1554          | button "Generate quote" / "Retry generate"                                                                                             | "Build the quote" / "Try again"                                                                       |
| 1648          | tooltip "Tap again to remove"                                                                                                          | Leave                                                                                                 |
| 2518          | top kicker labels "Building your quote" / "Tap to speak"                                                                               | "Building it" / "Tap to speak"                                                                        |
| 2674          | filler "Got it…"                                                                                                                       | Leave                                                                                                 |


### Messages (`src/routes/messages.tsx`)


| Line     | Current                                                     | Suggested                                  |
| -------- | ----------------------------------------------------------- | ------------------------------------------ |
| 135      | "Loading…"                                                  | Leave                                      |
| 136, 141 | subtitle "All caught up"                                    | "All caught up." (period) — or leave       |
| 157      | toast "Filters coming soon"                                 | "Filters coming soon." — leave             |
| 199      | "Unknown caller"                                            | "New lead"                                 |
| 221      | "Mark as read"                                              | "Mark read"                                |
| 275      | label "Customer" / "Auto-reply" / "You"                     | Leave                                      |
| 308      | notif "New quote request from {name}" / "New quote request" | "{name} wants a quote" / "New job request" |


### Chaser (`src/routes/chaser.tsx`)


| Line   | Current                                                           | Suggested                                       |
| ------ | ----------------------------------------------------------------- | ----------------------------------------------- |
| 19-21  | chip labels "Polite reminder" / "Firm follow-up" / "Final notice" | "Polite nudge" / "Firmer chase" / "Last chance" |
| 59, 74 | subtitle "Replies & payments"                                     | Leave                                           |
| 92     | section "Awaiting a reply"                                        | "Waiting on a reply"                            |
| 144    | section "Awaiting payment"                                        | "Waiting to be paid"                            |
| 217    | inline action "Send now"                                          | "Send it"                                       |
| 282    | "Awaiting payment"                                                | "Waiting to be paid"                            |


### Customers (`src/routes/clients.index.tsx`)


| Line | Current                          | Suggested                  |
| ---- | -------------------------------- | -------------------------- |
| 54   | subtitle "Customer book"         | Leave                      |
| 82   | cta "New customer"               | "Add customer"             |
| 87   | "No matches"                     | "Nothing matches."         |
| 89   | cta `Add "${q}" as new customer` | `Add "${q}" as a customer` |


### Settings (`src/routes/settings.tsx`)

This is admin/config — the brand voice guide says corporate-clear is fine here. Light touch only.


| Line    | Current                                                                                               | Suggested                              |
| ------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 89      | "Account deleted."                                                                                    | Leave                                  |
| 153     | "Couldn't save settings"                                                                              | Leave                                  |
| 175     | "Upload timed out"                                                                                    | Leave                                  |
| 182     | "Use a PNG or JPG image"                                                                              | Leave                                  |
| 186     | "Logo must be 5MB or smaller"                                                                         | Leave                                  |
| 190     | "You're offline — connect to upload your logo"                                                        | "You're offline. Reconnect to upload." |
| 208     | "Logo updated"                                                                                        | Leave                                  |
| 213     | "Upload timed out — check your connection"                                                            | Leave                                  |
| 215     | "Couldn't upload logo"                                                                                | Leave                                  |
| 229     | hint "Set your hourly + day rates"                                                                    | Leave                                  |
| 234     | hint "Add bank details so you get paid"                                                               | "Add bank details — get paid faster"   |
| 245     | subtitle "Configuration"                                                                              | "Your setup"                           |
| 272     | section "Your business"                                                                               | Leave                                  |
| 275     | summary "Add your business details"                                                                   | "Finish your business details"         |
| 349     | section "Your pricing"                                                                                | Leave                                  |
| 373     | section "Getting paid"                                                                                | Leave                                  |
| 429     | hint "Adds 20% VAT to every quote"                                                                    | Leave                                  |
| 449     | section "How quotes look"                                                                             | Leave                                  |
| 487     | hint "Adds a signature line at the bottom"                                                            | Leave                                  |
| 498     | section summary "Push & email alerts"                                                                 | Leave                                  |
| 506     | section title "Account & billing" / summary "Subscription, exports, sign out"                         | Leave                                  |
| 521     | section summary "Permanent account deletion"                                                          | "Delete your account"                  |
| 577     | button "Delete account" / "Deleting…"                                                                 | Leave                                  |
| 666-669 | notification toggle labels "New quote request" / "Quote approved" / "New message" / "Invoice overdue" | Leave — clear and scannable            |


### Send dialog (`src/components/SendQuoteDialog.tsx`)


| Line | Current                                             | Suggested                            |
| ---- | --------------------------------------------------- | ------------------------------------ |
| 86   | "Could not undo. Try again."                        | Leave                                |
| 122  | "Message copied — paste it into your chat or email" | "Copied. Paste it in chat or email." |
| 131  | "Could not create portal link"                      | Leave                                |
| 152  | "Could not copy link"                               | Leave                                |


### Invoices (`src/routes/invoices.$quoteId.tsx`)


| Line | Current                          | Suggested       |
| ---- | -------------------------------- | --------------- |
| 86   | "Invoice PDF downloaded"         | "Invoice saved" |
| 88   | "Could not generate PDF"         | Leave           |
| 95   | PageHeader title "Final invoice" | Leave           |
| 244  | "Could not mark as paid"         | Leave           |


### Leave as-is (flagged, no change recommended)

- All TRADE-specific helper hints in Settings (e.g. "Required to legally certify gas work in the UK.") — these are factual/legal, voice would weaken them.
- All field labels in Settings ("Bank account name", "Sort code", etc.) — must stay precise.
- Status badge labels driven by `StatusBadge.tsx` enum — already short; let me know if you want those reworded too.
- Error messages starting with "Could not …" — these are clear and consistent; rewriting each individually adds noise without much voice gain. **Flagging as one batch decision: do you want me to globally swap "Could not …" → "Couldn't …" across in-app toasts?**

### Open questions before I apply

1. **Q1 — Scope check.** Approve the table above wholesale? If you'd rather hand-pick, tell me which rows to skip and I'll proceed with the rest.
2. **Q2 — "Could not …" toasts.** Should I batch-swap all "Could not …" → "Couldn't …" in the in-app toasts for a more spoken tone, or leave them?
3. **Q3 — Status labels.** The `StatusBadge` enum drives "Pending / Sent / Accepted / Paid / Overdue / Draft / Declined". Want me to touch any of those, or leave?

This is a thorough, well-judged audit — and it shows Lovable absorbed the brand guide properly. The rewrites are on-voice (tight, plain, money-focused), it correctly left the legal/factual/field-label copy alone, and it's flagging the right batch decisions instead of guessing. Approve it, with a few targeted skips and answers to the three questions.

**Q1 — Scope: approve the table, but skip/adjust these specific rows.** A handful are a notch *too* casual or lose precision:

- **"Quote binned"** (deleting quotes) — I'd keep **"Quote deleted."** "Binned" is fun but a deletion confirmation is one place you want clarity over swagger — the user needs to be sure it's gone. Same for "Customer said no." → I'd keep **"Customer declined"** (the original "Customer declined this quote" → just "Customer declined"). "Said no" is slightly flippant on what might be a disappointing moment for the tradesperson.
- **"Accepted. Get on it."** — borderline. It's good energy, but "Get on it" could read as the app bossing them. I'd soften to **"Accepted. Nice one."** — celebrates without instructing. Your call; if you like the push, keep it.
- **"In today"** (was "Paid today") — skip this one, leave "Paid today." "In today" is too cryptic as a hero label; clarity matters on the money number. Lovable already marked it optional — decline it.
- Everything else in the table: **approve.** "Ready to send / Send it", "Waiting on a reply / Nudge them", "Build the quote", "Job done. Time to get paid.", the chaser chips ("Polite nudge / Firmer chase / Last chance") — all strong and on-voice.

**Q2 — "Could not…" → "Couldn't…": yes, batch-swap it.** It's a clean, low-risk way to make every error sound spoken rather than formal, and consistency across all toasts is worth it. "Couldn't save changes" is warmer than "Could not save changes" and still perfectly clear. Approve the global swap.

**Q3 — Status labels (Pending/Sent/Accepted/Paid/Overdue/Draft/Declined): leave them.** These are *functional state labels*, not voice moments — they need to be instantly scannable and conventional. Tradespeople (and their accounting exports) expect "Paid", "Sent", "Overdue". Don't get clever with status taxonomy; clarity beats brand here. Leave as-is.

So the reply to Lovable:

> Approved with these exceptions:
>
> - Keep "Quote deleted" (not "binned") everywhere — deletion needs clarity.
> - Keep "Customer declined" (not "said no").
> - Change "Accepted. Get on it." → "Accepted. Nice one."
> - Skip the "Paid today" → "In today" change — leave "Paid today".
> - Everything else in the table: apply.  
> Q2: Yes — batch-swap all "Could not…" → "Couldn't…" in in-app toasts.  
> Q3: Leave the StatusBadge labels unchanged.  
> Show me nothing further — apply once these are in.