## Placeholder audit findings

### Not done — real/fictional names still present:

| File | Line | Current placeholder | Issue | Fix |
|------|------|---------------------|-------|-----|
| `src/routes/onboarding.tsx` | 197 | `e.g. Cosy Plumbing & Heating` | Sounds like a real business | `e.g. Smith Plumbing & Heating` |
| `src/routes/onboarding.tsx` | 208 | `Full name` | Missing generic example | `e.g. John Smith` |
| `src/routes/auth.tsx` | 109 | `e.g. Alex Smith` | Inconsistent with requested example | `e.g. John Smith` |
| `src/routes/auth.tsx` | 111 | `you@trade.co.uk` | `.co.uk` could be real | `you@example.com` |
| `src/routes/forgot-password.tsx` | 68 | `you@trade.co.uk` | `.co.uk` could be real | `you@example.com` |
| `src/routes/settings.tsx` | 176 | `Street address` | Missing generic example | `e.g. 12 High Street` |
| `src/routes/settings.tsx` | 293 | `profile.full_name` (dynamic) | **Uses actual user personal data as placeholder** | `e.g. John Smith` |

### Already correct:
- Phone placeholders: `07XXX XXX XXX` / `07XXX XXXXXX` — already generic across onboarding, quotes.new, clients.new
- Email in clients.new: `name@example.com` — already correct
- Customer name in clients.new: `e.g. Customer name` — already generic

### Plan
Surgical text replacements in 4 files. No new files, no logic changes.
1. Update `onboarding.tsx` — business name + your name placeholders
2. Update `auth.tsx` — full name + email placeholders
3. Update `forgot-password.tsx` — email placeholder
4. Update `settings.tsx` — address line 1 + signature name (remove dynamic personal data)