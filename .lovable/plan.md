## Fix inaccurate claims in `src/lib/trades-data.ts`

Single file edit. Three targeted text changes.

### 1. Plumbers FAQ — SMS → WhatsApp (line 80)
The chaser opens WhatsApp / email, not SMS. There's no SMS sender in the codebase.
- Before: `"…polite reminders by email and SMS…"`
- After: `"…polite reminders by email and WhatsApp…"`

(Verified: this is the only `SMS` occurrence in `trades-data.ts`.)

### 2. Builders — remove false stage-invoicing claim

**Line 269** (FAQ "Can I take stage payments on a big build?"):
- Before: `"Yes. Break the build into stages on the quote (groundworks, walls, roof, second fix) and Quottr invoices each stage as you reach it — customer pays by card or bank transfer."`
- After: `"You can itemise the build by stage on the quote — groundworks, walls, roof, second fix — so the customer sees each phase's cost up front, and take a deposit on approval by card or Apple Pay. Quottr doesn't automatically invoice each stage as you reach it (yet); you'd send the final invoice for the balance at the end."`

**Line 234** (`seoDescription`):
- Before: `"…Big jobs broken into clear stages. Take stage payments. Free 14-day trial."`
- After: `"…Big jobs broken into clear stages on the quote. Deposit on approval. Free 14-day trial."`

### 3. Apple Pay — keep as-is
Stripe Checkout auto-enables Apple Pay on Apple devices, so all "card or Apple Pay" mentions remain accurate. No changes.

### Out of scope
Everything else stays: auto-chase claim, price-learning claims, voice prompts, all other FAQs, and all WhatsApp/deposit copy.
