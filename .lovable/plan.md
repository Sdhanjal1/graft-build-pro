## Plan: Quottr social media asset set

Generate three downloadable PNG artifacts to `/mnt/documents/quottr-social/` using a Node script with the `canvas` library (sharp text control, exact pixel dimensions, no AI hallucination on letterforms). Bebas Neue downloaded from Google Fonts for the condensed bold wordmark feel.

### Brand spec (applied to all 3)

- Background: `#16170f` (dark ink)
- Primary: `#c4f432` (lime)
- Wordmark: `QUOTTR` in Bebas Neue, tight tracking
- Same lime-on-ink treatment across the set for instant brand recognition

### Assets

**1. Profile icon — 1024×1024 PNG** (`quottr-profile.png`)

- Solid dark ink square
- Large lime `Q` centered, with a subtle lime dot/accent inside the Q's tail to echo the wordmark's letterform
- Sized so it reads cleanly when cropped to a circle (key elements inside an 880px safe circle)
- Bold, minimal — no taglines, no extra text

**2. YouTube banner — 2560×1440 PNG** (`quottr-youtube-banner.png`)

- Dark ink background
- All key content inside YouTube's 1546×423 TV-safe centre zone
- `QUOTTR` wordmark in lime, ~220pt, centered
- Tagline below: "Stop quoting in the evenings" in paper-white, lighter weight, smaller
- Tiny lime underline accent or single lime dot as a brand motif
- Outer areas (visible on desktop) get subtle off-center lime geometric accents — a few thin lime lines or a partial circle — so the wide canvas isn't dead space but the centre stays the hero

**3. Facebook cover — 820×312 PNG** (`quottr-facebook-cover.png`)

- Dark ink background
- `QUOTTR` wordmark left-aligned (or centered), lime
- Tagline "Stop quoting in the evenings" beneath
- Right side: subtle lime accent shape (single circle or stacked lines) for visual balance
- Mobile-safe: keep all text within the central 640×312 area that's visible on mobile

### Technical approach

1. `bun add canvas` in a scratch dir (or use existing if present); also download Bebas Neue .ttf via curl from Google Fonts
2. Single Node script generates all three PNGs at exact dimensions
3. Write outputs to `/mnt/documents/quottr-social/`

### QA (mandatory)

- View each generated PNG with the read tool
- Check: text isn't clipped, lime/ink contrast pops, profile icon survives circular crop, YouTube tagline sits inside TV-safe zone, Facebook text inside mobile-safe zone
- Fix any issues and re-render before delivering
- Emit `<presentation-artifact>` tags for all three so the user can download them

No code changes to the app. Pure artifact generation.

double check the colour code i suggested is exactly the colours used on the app and website to ensure consistency