# Reuse registered goon rope records
Main already retains mutable goon chest positions, but constructs discarded target records every reconciliation. Retain the full target record with its position instead; preserve identity until target removal and recreate on return.
