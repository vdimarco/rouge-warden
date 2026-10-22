- [x] Inspect loop timing, existing debug readout and performance QA.
- [x] Add bounded diagnostics and deterministic metric checks.
- [x] Verify live browser sampling and capture before/after evidence.
- [x] Record mandatory performance evidence protocol and honest score limits.
- [x] Review canonical spec and archive completed implementation.

Hardware Chrome acceptance remains open; no access to the user's Chrome tab is exposed by the browser connector.

Deterministic metric tests and all five software-browser checks pass. Before probe failed exactly four diagnostic assertions. Screenshots inspected. Hardware acceptance is intentionally still open under the evidence protocol; this implementation does not fix or close the reported slowdown.

Review correction: all six integration checks now pass, including invisible-input exclusion after three real loop ticks. Before correction exactly that new check failed. Deterministic metric tests and syntax checks still pass. Fresh remote review/CI/preview are required on the corrected head.
