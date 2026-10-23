# Design
All offer writes and readers inspected in jobs.js, main/actionview and QA. Guard the existing expiration filter with some(expired); retain its event emission and replacement semantics on removal. Typical idle frames scan offers once, expiry frames scan twice. No public snapshot changes. No rendering technique added.
