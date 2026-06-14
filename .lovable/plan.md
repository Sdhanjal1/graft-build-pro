## Plan — /merch on quottr.co.uk (Workshop Catalogue direction)

Goal: ship a credible-looking merch page on the marketing site this round, then layer real commerce (Shopify) once you've decided POD vs bulk. This keeps risk near zero and lets you gauge interest from real traffic before committing to inventory.

### Phase 1 — this build (no checkout yet)

What lands now:

- New route `src/routes/merch.tsx` styled to match the selected "Workshop Catalogue" direction (black bg, lime `#c8ff3e`, Bebas Neue headers, hardware-store price tags, member-discount strip).
- Reuses the existing `MarketingShell` header/footer so nav is consistent with the rest of quottr.co.uk.
- Catalogue of ~6 placeholder products (HD Tech Tote, Heavyweight Hoodie, Hi-Vis Tee, Insulated Steel Mug, Trucker Cap, Site Jacket) with name, short spec, price, mocked member price.
- Members callout strip — when a Quottr user is logged in, shows their 15% member badge; when logged out, shows a "Quottr members get 15% off — sign in" prompt.
- "Custom fleet branding" enquiry block at the bottom → mailto: link to your support address (no new form needed).
- Each product CTA is "Notify me when live" → opens a simple email-capture sheet that drops the email into a new `merch_interest` table. This gives you a real interest signal before you spend a penny on stock.
- Footer link added: `Shop` under quottr.co.uk footer.
- SEO: route-specific `head()` with title "Quottr Gear — workwear & kit for UK trades", description, og:title, og:description. No og:image until product photography exists.

What does NOT land yet:

- No Shopify connection, no real cart, no real checkout, no real product images. All product images are styled placeholder tiles (matching the prototype) so the page reads cleanly without needing photography first.
- No "Promoted in the app" banner yet — public page only. Easy to add later once you see traffic convert.

### Phase 2 — Shopify (separate build, after you decide POD vs bulk)

This is the real e-commerce step. I'll do it in a follow-up so you don't commit to a provider before you've seen interest. The flow then will be:

1. Enable Shopify (new dev store) so we can build the catalogue without touching any live store.
2. Connect Printful or Printify inside Shopify for print-on-demand fulfilment (recommended for launch — zero inventory, no risk).
3. Replace placeholder cards with live Shopify products; replace "Notify me" with real Add-to-Cart and Shopify checkout.
4. Wire member 15% discount as a Shopify discount code shown automatically to logged-in Quottr users.

You don't need to decide POD vs bulk today — Phase 1 stands on its own as a marketing/interest page.

### Technical details (for the record)

- New file: `src/routes/merch.tsx` — `createFileRoute("/merch")`, uses `MarketingShell`, content composed from React components in the same file (keeping it self-contained for now; can split later if it grows).
- New table via migration: `merch_interest` (id, email, product_slug, created_at, user_id nullable) with RLS:
  - GRANT INSERT to `anon` and `authenticated` (form is public).
  - GRANT SELECT, ALL to `service_role` only — you read it via the backend, never client-side.
  - Policy: anyone can insert; nobody can select from the client.
- Footer link added in the existing marketing footer component.
- No new dependencies. No backend changes beyond the one table.

### What I need from you before building

Nothing — happy to ship Phase 1 on these defaults. Tell me to go and I'll build it. If you'd rather skip the "Notify me" capture and just have the page sit as pure marketing (CTAs that scroll to the enquiry block), say so and I'll drop the table.

Can you also add actual pictures of each product with the Q logo or variations of it on each product