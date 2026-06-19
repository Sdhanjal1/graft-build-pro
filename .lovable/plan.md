## Goal

Copy-only updates in `src/routes/index.tsx`. No layout or logic changes.

## Changes

### 1. Hero headline (lines 37–38)
Drop "Quote it." — match the locked three-beat brand tagline. Keep "Get paid." on the lime accent so the visual rhythm stays intact.

```tsx
Speak it. <span className="text-lime">Send it.</span><br />
<span className="text-lime">Get paid.</span>
```

### 2. Hero sub-copy (line 42)
Replace the last sentence:

```tsx
Talk through the job on site. Quottr writes the quote, sends it on WhatsApp, and takes the payment — so you win it before the other guy's even quoted.
```

### 3. Final CTA headline (line 175)
Replace "Stop quoting in the evenings." with the money-focused line, line-broken to keep the existing two-line visual rhythm:

```tsx
Win the job.<br />Get paid.<br />Move on.
```

Sub-line (line 178) untouched.

## Out of scope

Demo video, "van to paid" three-step section, "Quottr does the bits other software won't", accounting/CSV section, trust elements — all left as-is.
