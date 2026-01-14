# calculateProject Benchmark

Simple benchmark for the `calculateProject` function via JS/WASM bindings.

## Usage

```bash
pnpm run bench
```

This will:

- Generate test projects of various sizes on-the-fly
- Run multiple iterations for each size
- Display timing results and performance scaling

## Project Sizes

- **original**: 1 assembly × 1 product = 1 product
- **small**: 10 assemblies × 10 products = 100 products
- **medium**: 50 assemblies × 20 products = 1,000 products
- **large**: 100 assemblies × 50 products = 5,000 products
- **xlarge**: 200 assemblies × 100 products = 20,000 products

Edit `runBenchmark.ts` to customize sizes and iterations.
