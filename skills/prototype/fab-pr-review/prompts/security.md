# Security Review Pass

Run this pass only when `metadata.json.security_relevant` is `true`.

Inspect the diff and relevant callers/consumers for:

- authentication and authorization bypasses
- IDOR and object ownership failures
- privilege boundary changes
- untrusted input reaching shell, SQL, template, expression, or deserialization sinks
- unsafe redirects, file paths, URLs, or proxy behavior
- token/JWT validation and audience/issuer/expiry assumptions
- secrets in source, logs, error messages, fixtures, or configuration
- alternate code paths that bypass the new security control
- insecure defaults and fail-open behavior
- sensitive data exposure

Every finding must pass the normal evidence gate. Do not report a generic checklist item without a concrete code path.
