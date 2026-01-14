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

The benchmarking tools have identified the following bottlenecks:

1. **Algorithm Complexity:** O(n^1.29) instead of expected O(n) - as project size increases, time per product degrades by 298.5%
2. **Root Cause:** Triple-nested loops in calculation engine (products × impact_categories × life_cycle_modules × impact_data)
3. **Data Passing:** Externref approach is faster than JSON serialization (JSON is 33% slower)

**Recommended Fix:** Optimize the calculation algorithm in `modules/calculation/src/calculate.rs`

---

## Interpreting Results

### Complexity Analysis

When `scalingAnalysis.ts` shows:

- **Exponent ≈ 1.0:** Linear scaling (good)
- **Exponent ≈ 1.3:** Sub-optimal scaling (current state)
- **Exponent ≈ 2.0:** Quadratic scaling (bad)

Time per product degradation:

- **< 50% increase:** Acceptable scaling
- **100-300% increase:** Significant degradation (current: 298.5%)
- **> 300% increase:** Critical performance issue

### Externref vs JSON Analysis

When `externrefVsJsonAnalysis.ts` shows:

- **Externref faster:** Current approach is optimal
- **JSON faster:** Consider switching to JSON serialization
- **Similar performance:** Bottleneck is elsewhere (likely calculation logic)

**Note:** JSON serialization overhead should be minimal (~30ms). If JSON approach is significantly slower, it's due to Rust JSON parsing overhead, not serialization.

---

## Benchmark Test Sizes

| Size     | Assemblies | Products/Assembly | Total Products | Iterations |
| -------- | ---------- | ----------------- | -------------- | ---------- |
| baseline | 1          | 1                 | 1              | 50-200     |
| small    | 10         | 10                | 100            | 30-100     |
| medium   | 50         | 20                | 1,000          | 10-50      |
| large    | 100        | 50                | 5,000          | 5-10       |

Adjust in the respective tool files to test different scenarios.

---

## Tips for Accurate Results

1. **Close other applications** to reduce system noise
2. **Run multiple times** and compare results
3. **Test with realistic data** when possible
4. **Compare before/after** when making optimizations

---

## Contributing

When adding new profiling capabilities:

1. Keep tools focused on specific aspects
2. Provide clear output interpretation
3. Save results to files for later analysis
4. Update this README with usage instructions
