
## Changes

### 1. Delete `src/routes/logo-preview.tsx`
- Remove the file. Zero inbound links confirmed in earlier audit.
- The TanStack Router Vite plugin will regenerate `routeTree.gen.ts` automatically.

### 2. Keep `src/routes/welcome.tsx` untouched
- No edits. Left as-is to avoid breaking any OAuth callback URL that may point at `/welcome`.

### 3. Add Messages to `src/components/BottomNav.tsx`
- Add a fifth nav item between **Quotes** and **Chasers** (most natural place since Messages is customer-reply heavy and Chasers is a follow-up tool).
- Use the `MessageSquare` icon from `lucide-react` (already imported in `messages.tsx`, will need import here).
- New `items` array:
  ```ts
  { to: "/app",      label: "Home",     icon: Home },
  { to: "/quotes",   label: "Quotes",   icon: FileText },
  { to: "/messages", label: "Inbox",    icon: MessageSquare },
  { to: "/chaser",   label: "Chasers",  icon: Clock },
  { to: "/settings", label: "Settings", icon: Settings },
  ```
- No other changes to `BottomNav`'s styling/animation logic — the existing flex layout handles 5 items.

## Notes / risks
- 5 items in the pill nav at 550px width: the active item expands with a label while inactive items are icon-only, so it still fits comfortably. No layout changes required.
- Unread badge on the Messages tab is **not** included in this scope — can be a follow-up if you want it.
