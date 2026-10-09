---
name: smart-manager-web
description: Next.js Smart Manager UI conventions (shadcn, API unwrap, error handling). Use when changing src/app, forms, workspace chrome, or client/server API calls.
---

# Smart Manager Web

- Parse Nest envelopes with `parseApiBody` or `serverApi`. Never assume the raw JSON is the payload.
- Surface errors with `src/app/error.tsx` / `global-error.tsx` and `errorMessage()` for user text.
- New controls should start from `src/components/ui` (shadcn) and `cn()` from `src/lib/utils`.
- Keep RTL (`lang="fa"`) and existing Dashlite shell classes unless replacing a whole view.
- Call the API with `credentials: "same-origin"` and `accept-language: fa` from the browser.
