---
name: Photo upload via Object Storage
description: How the presigned-URL photo upload flow is wired in this project.
---

## The rule
`requireAuth` in `artifacts/api-server/src/routes/admin.ts` must be `export function` so `storage.ts` can import it. Without the export, the storage route can't guard its upload endpoint.

**Why:** storage.ts is a separate router module that needs the same auth middleware as admin routes, and there was no shared middleware file — so we export from admin.ts directly.

**How to apply:** Any new route module that needs cookie-based auth should import `requireAuth` from `./admin`.

## objectPath format
`getObjectEntityUploadURL()` → `normalizeObjectEntityPath(uploadURL)` → returns `/objects/uploads/{uuid}`.

To display: strip the leading `/objects/` prefix and prepend `/api/storage/objects/`, e.g.:
```
/api/storage/objects/uploads/{uuid}
```

## TS quirk in objectStorage.ts
`response.json()` returns `unknown`, so destructuring `{ signed_url }` fails TS strict mode.
Fix: `const data = await response.json() as { signed_url: string }; const signedURL = data.signed_url;`
