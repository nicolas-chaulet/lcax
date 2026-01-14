import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateProject } from "../../src/lcax";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface BenchmarkResult {
    size: string;
    assemblies: number;
    products: number;
    totalProducts: number;
    iterations: number;
    totalTime: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
}

function generateProject(numAssemblies: number, productsPerAssembly: number, baseProject: any) {
    const baseAssembly = baseProject.assemblies[0];
    const baseProduct = baseAssembly.products[0];
    
    const assemblies = [];
    for (let i = 0; i < numAssemblies; i++) {
        const products = [];
        for (let j = 0; j < productsPerAssembly; j++) {
            products.push({
                ...baseProduct,
                id: `${baseProduct.id}-${i}-${j}`,
                name: `${baseProduct.name} ${i}-${j}`
            });
        }
        
        assemblies.push({
            ...baseAssembly,
            id: `${baseAssembly.id}-${i}`,
            name: `${baseAssembly.name} ${i}`,
            products
        });
    }
    
    return { ...baseProject, assemblies };
}

async function benchmarkProject(
    baseProject: any,
    size: string, 
    assemblies: number, 
    products: number,
    iterations: number = 10
): Promise<BenchmarkResult> {
    const testProject = generateProject(assemblies, products, baseProject);
    
    const times: number[] = [];
    
    console.log(`\nBenchmarking ${size} project (${assemblies} assemblies × ${products} products = ${assemblies * products} total products)`);
    console.log(`Running ${iterations} iterations...`);
    
    for (let i = 0; i < iterations; i++) {
        // Create a fresh copy for each iteration
        const project = JSON.parse(JSON.stringify(testProject));
        
        const start = performance.now();
        calculateProject(project);
        const end = performance.now();
        
        const time = end - start;
        times.push(time);
        
        process.stdout.write(`  Iteration ${i + 1}/${iterations}: ${time.toFixed(2)}ms\r`);
    }
    
    console.log(''); // New line after iterations
    
    const totalTime = times.reduce((a, b) => a + b, 0);
    const avgTime = totalTime / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    return {
        size,
        assemblies,
        products,
        totalProducts: assemblies * products,
        iterations,
        totalTime,
        avgTime,
        minTime,
        maxTime
    };
}

function printResults(results: BenchmarkResult[]) {
    console.log('\n' + '='.repeat(100));
    console.log('BENCHMARK RESULTS');
    console.log('='.repeat(100));
    console.log();
    console.log('| Size     | Assemblies | Products/Asm | Total Products | Avg Time (ms) | Min Time (ms) | Max Time (ms) | Ops/sec |');
    console.log('|----------|------------|--------------|----------------|---------------|---------------|---------------|---------|');
    
    for (const result of results) {
        const opsPerSec = (1000 / result.avgTime).toFixed(2);
        console.log(
            `| ${result.size.padEnd(8)} | ` +
            `${result.assemblies.toString().padStart(10)} | ` +
            `${result.products.toString().padStart(12)} | ` +
            `${result.totalProducts.toString().padStart(14)} | ` +
            `${result.avgTime.toFixed(2).padStart(13)} | ` +
            `${result.minTime.toFixed(2).padStart(13)} | ` +
            `${result.maxTime.toFixed(2).padStart(13)} | ` +
            `${opsPerSec.padStart(7)} |`
        );
    }
    
    console.log();
    console.log('Performance scaling:');
    for (let i = 1; i < results.length; i++) {
        const ratio = results[i].avgTime / results[i - 1].avgTime;
        const productRatio = results[i].totalProducts / results[i - 1].totalProducts;
        console.log(
            `  ${results[i - 1].size} → ${results[i].size}: ` +
            `${ratio.toFixed(2)}x slower for ${productRatio.toFixed(2)}x more products ` +
            `(efficiency: ${(productRatio / ratio * 100).toFixed(1)}%)`
        );
    }
}

async function main() {
    // Load the base project template
    const baseProjectPath = path.join(__dirname, '../calculate/datafixtures/project.json');
    const baseProjectData = await fs.readFile(baseProjectPath, 'utf-8');
    const baseProject = JSON.parse(baseProjectData);
    
    const sizes = [
        { assemblies: 1, products: 1, name: 'original', iterations: 50 },
        { assemblies: 10, products: 10, name: 'small', iterations: 30 },
        { assemblies: 50, products: 20, name: 'medium', iterations: 10 },
        // { assemblies: 100, products: 50, name: 'large', iterations: 5 },
        // { assemblies: 200, products: 100, name: 'xlarge', iterations: 3 },
    ];
    
    const results: BenchmarkResult[] = [];
    
    for (const size of sizes) {
        try {
            const result = await benchmarkProject(
                baseProject,
                size.name,
                size.assemblies,
                size.products,
                size.iterations
            );
            results.push(result);
        } catch (error) {
            console.error(`Error benchmarking ${size.name}:`, error);
        }
    }
    
    printResults(results);
}

main().catch(console.error);
