# Prompt B — voice + request + inbox fixes

Five-part prompt. **#5 (inbox badge) is already implemented** in `BottomNav.tsx` (lime dot, 30s refetch, focus refetch, sr-only label) and `messages.tsx` already shows "X requests · N new", so no work there. Below covers #1–#4.

---

## 1. Live voice flow keeps AI title / clean description / extracted customer

`src/routes/quotes.new.tsx`

- Add ref alongside the other voice refs (~line 199):
  `const lastLiveGenRef = useRef<{ title?: string; clean_description?: string; extracted_customer?: { name?: string; phone?: string } } | null>(null);`
- In `regenerateLiveQuote` (~line 592), when `g.line_items?.length`, also store the metadata: `lastLiveGenRef.current = { title: g.title, clean_description: g.clean_description, extracted_customer: g.extracted_customer };` (only update on a successful, current-session response — alongside the existing `setLiveItems`).
- In `startRecording` (~line 646), reset `lastLiveGenRef.current = null;` next to the other session resets.
- In `mr.onstop`, replace the items-success block (~lines 748–752):
  ```ts
  const meta = lastLiveGenRef.current;
  const built = {
    title: meta?.title?.trim() || deriveTitle(items),
    line_items: items,
  };
  setDraft(built);
  originalDraftRef.current = JSON.stringify(items);
  setDesc(meta?.clean_description?.trim() || liveFinalRef.current.trim());
  const ec = meta?.extracted_customer;
  if (ec?.name && !clientName.trim()) setClientName(ec.name);
  if (ec?.phone && !clientPhone.trim()) setClientPhone(ec.phone);
  ```
  `deriveTitle` and raw transcript remain fallbacks only.

## 2. Mid-recording edits/deletes survive next regeneration

`src/routes/quotes.new.tsx`

- Add two refs next to voice state, reset both in `startRecording`:
  ```ts
  const deletedDescsRef = useRef<Set<string>>(new Set());
  const editedItemsRef = useRef<Map<string, LineItem>>(new Map());
  ```
- Add a small helper `const norm = (s: string) => s.trim().toLowerCase();`.
- VoiceOverlay handlers in the parent (~lines 1073–1086):
  - `onDeleteItem`: before splicing, push `norm(prev[index].description)` into `deletedDescsRef.current`.
  - `onUpdateItem`: capture `const origKey = norm(prev[index].description);` first; apply patch; `editedItemsRef.current.set(origKey, patched);`. If `patch.description` and `norm(patch.description) !== origKey`, also `deletedDescsRef.current.add(origKey)` so the AI's old version doesn't reappear.
- In `regenerateLiveQuote`, after `g.line_items?.length` check, post-process before `setLiveItems`:
  ```ts
  const filtered = g.line_items
    .filter((li) => !deletedDescsRef.current.has(norm(li.description)))
    .map((li) => editedItemsRef.current.get(norm(li.description)) ?? li);
  setLiveItems(filtered);
  liveItemsRef.current = filtered;
  ```
  An empty `filtered` (from a non-empty `g.line_items`) still applies — that's the user's intent.

No fuzzy matching, exact normalised match only.

## 3. Voice-chain timeouts

- `src/routes/quotes.new.tsx` — `waitForPendingPhraseProcessing` already has a 30s cap (the prompt's snippet already lives there). No change.
- `src/lib/ai-quote.functions.ts` — find every `fetch("https://api.anthropic.com/...")` call and add `signal: AbortSignal.timeout(60_000)`. Wrap in try/catch; on `AbortError` / `TimeoutError`, throw `new Error("Took too long — check your connection and try again.")`. Preserve existing error mapping (429 / 402 etc.).
- `src/lib/ai-capture-quote.functions.ts` — same treatment for its Anthropic fetch.
- `src/lib/transcribe.functions.ts` — same treatment for the OpenAI Whisper fetch.

## 4. Anonymous quote-request flow

`src/routes/request.$proId.tsx`

- Import `supabase` from `@/integrations/supabase/client`.
- Add `const anonAttemptedRef = useRef(false);` and `const [anonError, setAnonError] = useState<string | null>(null);`.
- In an effect that runs when `!sessionLoading && !session && !anonAttemptedRef.current`: set the flag, call `supabase.auth.signInAnonymously()`, on success do nothing (the existing `useSession` listener will pick up the new session), on failure `setAnonError(...)`.
- Render order:
  - `sessionLoading` → spinner (unchanged).
  - `!session && !anonError` → spinner (anon sign-in in progress).
  - `!session && anonError` → existing `<CustomerAuth pro={pro} />` fallback.
  - otherwise → form.
- For sessions where `session.user.is_anonymous === true` (or more robustly: always when no email on the user), require name + phone:
  - Disable Send unless `customerName.trim()` and `customerPhone.trim()` are filled.
  - Inline message under the form: "Add your name and phone so they can get back to you."
- Server fn `createQuoteRequest` and RLS unchanged — anonymous users still have a real `auth.uid()`.
- Setup note for Sunny: enable anonymous sign-ins in Lovable Cloud Auth providers.

## 5. Inbox unread badge — already done

No code change needed. `src/components/BottomNav.tsx` already queries `getMyIncomingRequests` (30s interval, refetch on focus, retries off), renders the lime dot on `/messages` only, with the "unread requests" sr-only swap. `src/routes/messages.tsx` already shows the "N requests · M new" header.

---

## Out of scope (explicit)

- No payments/webhook changes (Prompt A territory).
- No AI prompt changes.
- No new dependencies.
- No server-fn or RLS changes for #4.

## Acceptance

1. Live voice → stop → draft has 3–4 word title, clean description, customer fields pre-filled when mentioned.
2. Delete a line mid-recording, keep talking → line stays gone after next pause regenerate. Same for edits.
3. Network killed mid-recording → screen unblocks within ≤30s or shows friendly timeout error.
4. `/request/<proId>` logged out → no signup screen, form visible after silent anon sign-in; Send blocked until name + phone present.
5. Unread request → lime dot on Inbox; opening clears within 30s or on focus (already working).
