---
"@klnap/payload-storage-sanity": patch
---

Harden populate and path handling flagged by CodeQL. Populate `extend` ignores `__proto__` keys and reads only own properties, so it can no longer change the returned object's prototype. Populate `exclude` traverses only own properties, so it cannot delete members of `Object.prototype`. Slash trimming for CDN origins, sync base paths, and media folder paths now runs in linear time instead of using quadratic regular expressions. No public API changes.
