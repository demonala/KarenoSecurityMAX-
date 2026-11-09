---
name: perf-tuning
description: "V8 runtime optimization, algorithmic complexity reduction, and low-latency I/O."
version: 1.0.0
---
# Performance Tuning Skill

- Eliminate N+1 queries and sequential I/O waterfalls using `Promise.all` or bounded worker pools.
- Prefer streaming buffers and iterators over loading multi-megabyte files into memory at once.
- Avoid quadratic (`O(n^2)`) array lookups in hot loops; use `Map` and `Set` for `O(1)` indexing.
- Profile execution time on critical paths and report measurable latency improvements.
