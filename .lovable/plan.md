## Fix: `permission denied for function generate_portal_code`

### Cause

When a quote is saved, the app inserts a new row into `public.clients` (`src/lib/user-data.ts:1088`). That fires the `BEFORE INSERT` trigger `trg_set_client_portal_code`, which runs `set_client_portal_code()` → which calls `generate_portal_code()`.

Current grants (from `pg_proc.proacl`):

```
generate_portal_code     → postgres, service_role, sandbox_exec   (NO authenticated)
set_client_portal_code   → postgres, service_role, sandbox_exec   (NO authenticated)
```

Neither function is `SECURITY DEFINER`, so both execute as the calling role (`authenticated`). The trigger itself fires because trigger execution doesn't require EXECUTE on the trigger function, but the nested call to `generate_portal_code()` from inside `set_client_portal_code` does — and `authenticated` has none. Hence "permission denied for function generate_portal_code" on quote save.

### Fix (minimal, no SECURITY DEFINER needed)

Grant EXECUTE on the two functions to `authenticated`. `generate_portal_code` only builds a random 32-char string from a fixed alphabet — no table access, no privilege concerns — so plain EXECUTE is safe and avoids changing the security model.

Migration:

```sql
GRANT EXECUTE ON FUNCTION public.generate_portal_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_client_portal_code() TO authenticated;
```

I'll skip `anon` — portal/public paths don't insert clients, only authenticated traders do.

I am NOT changing either function to `SECURITY DEFINER`, since EXECUTE grants are sufficient and don't elevate privileges.

### Verify

After the migration, re-check `pg_proc.proacl` shows `authenticated=X/...` for both functions, then save a quote with a new client from the app to confirm the trigger runs without error.

### Files

- One new migration only. No application code changes.