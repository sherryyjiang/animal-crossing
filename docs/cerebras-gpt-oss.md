# Cerebras gpt-oss API Notes (Browser Client)

## Source Links
- https://inference-docs.cerebras.ai/api-reference/authentication
- https://inference-docs.cerebras.ai/support/rate-limits
- https://inference-docs.cerebras.ai/api-reference/chat-completions

## Auth + Endpoint
- Base URL: `https://api.cerebras.ai/v1`
- Auth: `Authorization: Bearer CEREBRAS_API_KEY`
- Docs explicitly warn not to include API keys in client-side code.

## Rate Limits (from docs)
- Limits are enforced by requests and tokens; whichever hits first.
- gpt-oss-120b example (Free tier): 60K TPM, 1M TPH, 1M TPD, 30 RPM, 900 RPH, 14.4K RPD.
- Developer tier is higher (1M TPM, 1K RPM) with no hourly/daily caps.
- Rate limit headers are returned on responses for monitoring.

## CORS
- The docs do not state whether browser CORS is enabled.
- Assume CORS may be blocked; verify before wiring direct client calls.

## Browser-Only Call Plan (Constraint-Aware)
The project is currently browser-only, but the API key cannot be shipped in client code. To reconcile:

1. **Primary plan (secure)**: use a lightweight server proxy or edge function to hold the API key and forward requests. This should be the long-term path.
2. **Interim plan (dev-only)**: allow users to paste their own API key into a local settings screen, store it in IndexedDB, and call the API directly from the browser if CORS permits. This is explicitly for local development and not for production.

This mismatch should be surfaced in the UI and docs until a backend proxy exists.

