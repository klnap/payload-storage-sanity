---
"@klnap/payload-storage-sanity": patch
---

Test infrastructure only: integration tests fail when PostgreSQL is unavailable, refuse production-looking database hosts, and remove their test container on success, failure, and interruption. No runtime change.
