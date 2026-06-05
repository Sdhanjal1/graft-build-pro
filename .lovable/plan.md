In `src/lib/user-data.ts`, update `markQuotePaid` to drop the non-existent `paid_at` column from the Supabase update payload.

Change:
```ts
.update({ status: "paid", paid_via: paidVia, paid_at: paidAt })
```
to:
```ts
.update({ status: "paid", paid_via: paidVia })
```

Also remove the now-unused `paidAt` local variable. No schema changes; `updated_at` continues to track when the row last changed.