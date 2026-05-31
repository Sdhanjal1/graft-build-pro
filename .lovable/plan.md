Remove remaining hardcoded 50% deposit assumptions across two files so all card-request amounts and WhatsApp message text use the quote's actual configured deposit (`deposit_amount` / `deposit_percent`).

### Changes

**src/routes/quotes.$quoteId.tsx**

1. `createPaymentRequest` — `type === "deposit" ? quote.total * 0.5` → `configuredDeposit`.
2. `takePaymentOnSite` — same `quote.total * 0.5` → `configuredDeposit`.
3. "Request payment" sheet `RequestOption` — label `"Deposit (50%)"` → `"Deposit (${configuredDepositPct}%)"`, amount `formatGBP(quote.total * 0.5)` → `formatGBP(configuredDeposit)`.

**src/lib/user-data.ts**

4. `buildPaymentRequest` — `type === "deposit" ? +(quote.total * 0.5)...` → compute the quote's configured deposit (explicit `deposit_amount` first, then `total * (deposit_percent/100)`).
5. `buildDepositOnAcceptMessage` — amount from `quote.total * 0.5` to configured deposit; message text `"a 50% deposit of £X"` → `"a deposit of £X"`.

No other logic changes. Invoice balance and deposit recording already use the real configured deposit.