## Generate clean job descriptions and extract customer details from voice transcripts

### 1. `src/lib/ai-quote.functions.ts` (voice-quote AI)

Extend `QuoteSchema`:
```ts
const QuoteSchema = z.object({
  title: z.string().min(1).max(160),
  clean_description: z.string().min(1).max(1000),
  extracted_customer: z.object({
    name: z.string().max(200).optional(),
    phone: z.string().max(50).optional(),
    email: z.string().max(200).optional(),
  }).optional(),
  line_items: z.array(LineItemSchema).min(1).max(20),
});
```

Append to `SYSTEM_PROMPT`:
- **JOB DESCRIPTION** section: write a clean, concise, professional summary of the work. Extract only the scope. Do NOT include customer names, phone numbers, email addresses, or conversational filler ("thank you", "I need", "can you", "so basically"). Include the worked example ("Supply and fit 4 radiators including connecting pipework, filling, bleeding and balancing.").
- **EXTRACTED CUSTOMER DETAILS** section: if the tradesperson mentioned a customer name, phone, or email in the transcript, return them in `extracted_customer`. Omit fields not mentioned.

Update user-prompt JSON shape to include `clean_description` and `extracted_customer`.

### 2. `src/lib/ai-capture-quote.functions.ts` (on-site capture AI)

Same schema additions and same prompt additions, since the same problem applies.

### 3. `src/routes/quotes.new.tsx`

After `generateFn(...)` returns at line 410:
- If `g.clean_description` exists, `setDesc(g.clean_description)` instead of (or in addition to) the raw `text`.
- If `g.extracted_customer?.name` and `clientName` is empty, populate it.
- If `g.extracted_customer?.phone` and `clientPhone` is empty, populate it.

At line 441 (`save`), the description passed to `saveGeneratedQuote` will now be the cleaned version since `desc` is already replaced.

### 4. Verify

Build check. Quote detail page and customer portal already read `quote.description` — no UI changes needed.

**Scope:** 3 files. No DB migration. No portal/quote-view changes.