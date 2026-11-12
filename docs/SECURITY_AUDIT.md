# Security audit

Audit date: 6 Nov 2026. Scope: the Express and React application in this repository. No production database command was run. No secret value is recorded here.

## Findings

| Severity | Finding | Status |
| --- | --- | --- |
| High | Admin pages could show a fictional user list and the client could previously switch its own role. Server role is now the only source, and privileged APIs deny everyone except `system_admin`. | Fixed |
| High | No response security headers. | Fixed. Production also sends CSP and HSTS. Dev omits CSP so Vite can run. |
| High | A session issued before login stayed valid after a new login. | Fixed. Login and signup revoke that account's older sessions. |
| High | State-changing requests were protected only by `SameSite=Lax`. | Fixed. A browser `Origin` on another host is rejected with 403. |
| High | Rate limits lived in one process. | Fixed. Counters are in PostgreSQL. A database error returns 503 and does not fall back to memory. |
| Medium | Signup can reveal that an email is already registered. Login uses one `bad_login` code for an unknown, wrong, or suspended account. | Open. The signup form depends on `email_taken`. |
| Medium | Password recovery has no mail provider. `POST /api/auth/forgot` returns `503 recovery_unavailable` for every well-formed address and does not create a token or look up the account. | Open until an SMTP provider is chosen. |
| Medium | `npm audit` on 6 Nov 2026, after Vitest `3.2.7`: 2 critical, 5 moderate, 2 low. The previous Vitest UI advisory is gone. The remaining critical items are tinypool `1.1.1` through Vitest. The only non-breaking-free fix npm offers is Vitest `5.1.0`. | Open. Not upgraded to Vitest 5. |
| Low | New passwords use scrypt `N=32768`, `r=8`, `p=1`. Older `scrypt$salt$hash` values stay valid and are rewritten after a successful login. | Fixed for new and returning passwords. Existing hashes are not reset. |
| Low | `X-Powered-By` identified Express. | Fixed in code. |
| Low | Health reports migration names and database reachability. It does not report credentials. | Accepted. |

Passwords use versioned scrypt. A hash shaped `scrypt$salt$hash` is the previous Node default, `N=16384`, `r=8`, `p=1`. A hash shaped `scrypt$2$32768$8$1$salt$hash` is the current cost. `N=32768` uses about 32 MB for one hash, which fits the small production container better than OWASP's `N=131072` at about 128 MB per concurrent hash. Login rewrites an old hash only after the password checks. No account is forced through a reset.

Rate limits live in PostgreSQL table `rate_limits`, which every app instance already shares. There is no Redis service in `liara.json`. A failed counter write returns 503 and does not use process memory. Login allows 10 attempts per email and 30 per network address each 15 minutes. Signup allows 5 per email and 20 per address each hour. The unavailable recovery route allows 5 per email and 20 per address each hour. AI routes allow 30 per account each 15 minutes. Admin routes allow 60 per admin each 15 minutes. The address comes from the socket unless `trust proxy` is set. Production sets that value to 1, for Liara's one proxy hop. The application does not read `X-Forwarded-For` itself.

`vite.config.ts` imports Vite only. Vitest's config is `vitest.config.ts`, so `vite build` does not load Vitest. `npm test` still does. `shadcn` is listed in dependencies and is not imported by `server.js` or the client entry. Its audit findings are transitive and the suggested repair is a major version change, which was not applied.

No payment provider is configured. Checkout still returns `payment_unavailable` and does not write a payment.
