# LCAX Performance Profiling Suite

A comprehensive toolkit for identifying performance bottlenecks in the LCAX calculation engine.

## Quick Start

**For investigating runtime bottlenecks:**

```bash
cd packages/javascript
pnpm run bench              # Quick timing benchmark
pnpm run bench:scaling      # Analyze algorithm complexity
pnpm run bench:validate     # Compare externref vs JSON approaches
```

## Tools Overview

### 1. `runBenchmark.ts` - Basic Timing Benchmark

Quick performance comparison across different project sizes.

**Usage:**

```bash
pnpm run bench
```

**What it measures:**

- Total execution time across different project sizes
- Operations per second
- Scaling efficiency

**Best for:** Quick performance comparisons and regression testing.

---

### 2. `scalingAnalysis.ts` - Algorithm Complexity Analyzer ⭐

**Use this to identify if you have O(n²) or worse complexity**

**Usage:**

```bash
pnpm run bench:scaling
```

**What it measures:**

- How execution time grows with data size
- Estimates algorithm complexity (O(n), O(n log n), O(n²))
- Time per product degradation
- Growth rate at each scale

**Output:**

- Complexity exponent (1.0 = linear, 2.0 = quadratic)
- Time per product at different scales
- Specific recommendations based on findings

**Best for:** Understanding why large projects are slow and what to fix.

---

### 3. `externrefVsJsonAnalysis.ts` - Externref vs JSON Comparison

**Validates if externref property access or calculation algorithm is the bottleneck**

**Usage:**

```bash
pnpm run bench:validate
```

**What it measures:**

- Current approach (externref - object passed directly)
- Alternative approach (JSON string serialization in Rust)
- JSON serialization overhead
- Performance comparison

**Output:**

- Side-by-side performance comparison
- Analysis of which approach is faster
- Determines if externref is the bottleneck

**Best for:** Definitively identifying if the bottleneck is in data passing or calculation logic

- **Bottom-Up:** Most expensive functions first

**Best for:** Deep-dive analysis of JavaScript/WASM bridge performance.

---

## Key Findings

The benchmarking tools show excellent performance characteristics:

1. **Algorithm Complexity:** O(n^0.89) - nearly linear scaling! ✅
   - Time per product decreases by 43.6% as project size increases (from 0.060ms to 0.034ms per product)
   - This indicates excellent optimization and likely benefits from cache locality at scale
2. **Data Passing:** JSON approach is slightly faster (~5-10% speedup)
   - JSON approach: avg 1.10x faster than externref
   - Both approaches are viable; the difference is minimal
3. **Scaling Efficiency:** Performance remains consistent across different project structures
   - 1000 products (50×20): 33ms avg
   - 1000 products (1000×1): 49ms avg
   - 5000 products (250×20): 158ms avg
   - 5000 products (5000×1): 243ms avg

**Current State:** The calculation engine is well-optimized with excellent linear scaling characteristics.

---

## Interpreting Results

### Complexity Analysis

When `scalingAnalysis.ts` shows:

- **Exponent ≈ 1.0:** Linear scaling (good)
- **Exponent ≈ 0.89:** Sub-linear scaling (excellent! Current state)
- **Exponent ≈ 1.3+:** Super-linear scaling (needs optimization)
- **Exponent ≈ 2.0:** Quadratic scaling (bad)

Time per product behavior:

- **Decreasing:** Excellent - benefits from cache locality or amortized costs (current: -43.6%)
- **< 50% increase:** Acceptable scaling
- **100-300% increase:** Significant degradation - needs investigation
- **> 300% increase:** Critical performance issue

### Externref vs JSON Analysis

When `externrefVsJsonAnalysis.ts` shows:

- **JSON faster:** JSON serialization approach is slightly more efficient (current: 1.10x avg speedup)
- **Externref faster:** Direct object passing is optimal
- **Similar performance (< 20% difference):** Both approaches are viable; bottleneck is elsewhere (calculation logic)

**Current Finding:** JSON approach shows a modest 5-10% performance improvement, but both approaches perform well. The serialization overhead (typically 16-60ms for 1000-5000 products) is offset by more efficient Rust-side processing.

---
