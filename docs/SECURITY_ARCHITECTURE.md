# Security architecture

The browser holds no session token. The server sets `bandora_session` as `HttpOnly`, `SameSite=Lax`, and `Secure` in production. The database stores only the SHA-256 hash of the token. Logout revokes that hash. A new login revokes the account's older sessions before issuing a new token.

`users.role` is assigned by the database default `learner` or by `POST /api/admin/users/:id/role`. That route requires a signed-in `system_admin`, refuses a change to the caller's own row, and writes an audit row. Signup ignores a role sent by the client. `setRole` in the browser store does not change the account.

`requireAdmin` is the single gate for `/api/admin/*`. A missing session is 401. Any other role is 403 and is recorded as `denied` without the request body. `content_manager` and `support_agent` are not privileged. There is no separate super-admin role.

A suspended account cannot start a session. Existing sessions for that account are revoked. The login error stays `bad_login`.

Every JSON response is limited to 1 MB. Authentication is limited to 20 attempts per address per 15 minutes. Placement, mocks, and the assistant are limited to 30 calls per account per 15 minutes. AI quota is a separate check and is not a substitute for this limit.

Production sets `trust proxy` to one hop and adds:

- `Content-Security-Policy` with `default-src 'self'`, no framing, and inline styles only
- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` that disables camera, geolocation, and payment

The development server sends the framing, sniffing, referrer, and permissions headers. It does not send CSP, because the Vite middleware needs its own scripts.

Shared limits are the `rate_limits` rows described in the audit. Production must have `DATABASE_URL`. Without that database the API is not mounted, and the process does not keep a private counter to serve production traffic.

Password recovery is intentionally unavailable. The forgot page button stays disabled. A direct `POST /api/auth/forgot` does not store a token, does not send mail, and answers `503` for both known and unknown addresses.
