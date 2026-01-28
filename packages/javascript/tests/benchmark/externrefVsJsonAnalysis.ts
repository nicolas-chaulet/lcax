import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateProject, calculateProjectFromJson, projectSerde } from "../../src/lcax.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Comparison test to compare externref vs JSON string approach for passing data around
 * 
 * Strategy:
 * 1. Test current approach (externref - object passed directly)
 * 2. Test alternative approach (JSON string serialization)
 * 3. Evaluate the cost of the serialization/deserialization separately
 * 4. Compare the performance difference
 */

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

async function testExternrefApproach(
    project: any,
    iterations: number
): Promise<{ avgTime: number; minTime: number; maxTime: number }> {
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
        const testProject = structuredClone(project);
        
        const start = performance.now();
        calculateProject(testProject);
        const end = performance.now();
        
        times.push(end - start);

        if (global.gc) {
            global.gc();
        }
    }
    
    return {
        avgTime: times.reduce((a, b) => a + b, 0) / times.length,
        minTime: Math.min(...times),
        maxTime: Math.max(...times)
    };
}

async function testJsonApproach(
    project: any,
    iterations: number
): Promise<{ avgRustTime: number;  avgTime: number; minTime: number; maxTime: number;  }> {
    // Check if JSON-based function exists
    const rustTimes: number[] = [];
    const totalTimes: number[] = [];
    
    for (let i = 0; i < iterations; i++) {        
        const start = performance.now();
        const jsonString = JSON.stringify(project);
        const rustStart = performance.now();
        const resultJson = calculateProjectFromJson(jsonString);
        const rustEnd = performance.now();
        JSON.parse(resultJson);
        const end = performance.now();
        
        totalTimes.push(end - start);
        rustTimes.push(rustEnd - rustStart);
        if (global.gc) {
            global.gc();
        }
    }
    return {
        avgRustTime: rustTimes.reduce((a, b) => a + b, 0) / rustTimes.length,
        avgTime:totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length,
        minTime: Math.min(...totalTimes),
        maxTime: Math.max(...totalTimes),
    };

}

async function testSerde(
    project: any,
    iterations: number
): Promise<{ avgRustTime: number; avgTime: number; minTime: number; maxTime: number;  }> {
    // Check if JSON-based function exists
    const rustTimes: number[] = [];
    const totalTimes: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const jsonString = JSON.stringify(project);
        const rustStart = performance.now();
        const resultJson = projectSerde(jsonString);
        const rustEnd = performance.now();
        JSON.parse(resultJson);
        const end = performance.now();
        
        totalTimes.push(end - start);
        rustTimes.push(rustEnd - rustStart);
        if (global.gc) {
            global.gc();
        }
    }
    
    return {
        avgRustTime: rustTimes.reduce((a, b) => a + b, 0) / rustTimes.length,
        avgTime: totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length,
        minTime: Math.min(...totalTimes),
        maxTime: Math.max(...totalTimes),
    };
}

async function compareApproaches(
    baseProject: any,
    config: { assemblies: number; products: number; name: string }
) {
    const { assemblies, products, name } = config;
    const testProject = generateProject(assemblies, products, baseProject);
    const totalProducts = assemblies * products;
    const iterations = assemblies <= 10 ? 20 : assemblies <= 50 ? 15 : 10;
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`${name}: ${assemblies}×${products} = ${totalProducts} products`);
    console.log('='.repeat(80));
    
    // Warm up
    for (let i = 0; i < 3; i++) {
        calculateProject(structuredClone(testProject));
    }
    
    // Test externref approach
    console.log('\nTesting externref approach (current)...');
    const externrefResults = await testExternrefApproach(testProject, iterations);
    console.log(`  Avg: ${externrefResults.avgTime.toFixed(2)}ms`);
    
    // Test JSON approach
    console.log('\nTesting JSON string approach...');
    const jsonResults = await testJsonApproach(testProject, iterations);
    console.log(`  Avg: ${jsonResults.avgTime.toFixed(2)}ms`);
    console.log(`  Avg Rust: ${jsonResults.avgRustTime.toFixed(2)}ms`);

    // SERDE time
    console.log('\nTesting SERDE serialisation time...');
    const serdeResults = await testSerde(testProject, iterations);
    console.log(`  Avg: ${serdeResults.avgTime.toFixed(2)}ms`);
    console.log(`  Avg Rust: ${serdeResults.avgRustTime.toFixed(2)}ms`);
    return {
        name,
        totalProducts,
        externref: externrefResults,
        json: jsonResults,
        serde: serdeResults,
    };
}

function printComparison(results: any[]) {
    console.log('\n' + '='.repeat(100));
    console.log('EXTERNREF vs JSON COMPARISON');
    console.log('='.repeat(100));
    
    console.log('\n📊 Performance Comparison:');
    console.log('─'.repeat(100));
    console.log('|            Size          | Products | Externref (ms) | JSON (ms) | Serialization overhead (ms) | Speedup | Verdict |');
    console.log('|--------------------------|----------|----------------|-----------|-----------------------------|---------|---------|');
    
    for (const r of results) {
        const speedup = r.externref.avgTime / r.json.avgTime;
        const verdict = speedup > 1.5 ? '✅ HUGE WIN' : speedup > 1.0 ? '✅ WIN' : '⚠️ SLOWER';
        
        console.log(
            `| ${r.name.padEnd(24)} | ` +
            `${r.totalProducts.toString().padStart(8)} | ` +
            `${r.externref.avgTime.toFixed(2).padStart(14)} | ` +
            `${r.json.avgTime.toFixed(2).padStart(9)} | ` +
            `${r.serde.avgTime.toFixed(2).padStart(27)} | ` +
            `${speedup.toFixed(2).padStart(6)}x | ` +
            `${verdict.padEnd(6)} |`
        );
    }
    
    console.log('\n📈 Analysis:');
    const avgSpeedup = results
        .reduce((sum, r) => sum + (r.externref.avgTime / r.json.avgTime), 0) / 
        results.length;
    
    console.log(`Average speedup: ${avgSpeedup.toFixed(2)}x`);
    
    if (avgSpeedup > 2) {
        console.log('\n✅ EXTERNREF IS DEFINITELY THE BOTTLENECK!');
        console.log('JSON approach is 2x+ faster despite serialization overhead.');
        console.log('The property access overhead is the main issue.');
    } else if (avgSpeedup > 1.2) {
        console.log('\n⚠️  EXTERNREF HAS SIGNIFICANT OVERHEAD');
        console.log('JSON approach is faster, confirming externref is part of the problem.');
    } else if (avgSpeedup > 0.9) {
        console.log('\n➡️  BOTH APPROACHES ARE SIMILAR');
        console.log('Externref overhead exists but is balanced by serialization cost.');
    } else {
        console.log('\n❌ JSON APPROACH IS SLOWER');
        console.log('Serialization overhead exceeds externref cost.');
        console.log('The bottleneck is likely in the calculation algorithm itself.');
    }
    
    // Show what we learned from serialization overhead
    console.log('\n💡 Serialization Overhead Insights:');
    console.log('─'.repeat(100));
    
    for (const r of results) {
        const serializationPercent = (r.serialization.total / r.externref.avgTime) * 100;
        console.log(`\n${r.name}:`);
        console.log(`  Total calculation time: ${r.externref.avgTime.toFixed(2)}ms`);
        console.log(`  Serialization overhead: ${r.serialization.total.toFixed(2)}ms (${serializationPercent.toFixed(1)}%)`);
        
        if (serializationPercent < 10) {
            console.log(`  → Serialization is cheap - JSON approach would be viable`);
        } else if (serializationPercent < 30) {
            console.log(`  → Serialization has cost but may be worth it`);
        } else {
            console.log(`  → Serialization is expensive relative to calculation`);
        }
    }
}

async function main() {
    console.log('LCAX Externref Hypothesis Validation');
    console.log('=====================================\n');
    console.log('This tool compares externref vs JSON string approaches');
    console.log('to definitively identify if externref property access is the bottleneck.\n');
    
    const baseProjectPath = path.join(__dirname, '../calculate/datafixtures/project.json');
    const baseProjectData = await fs.readFile(baseProjectPath, 'utf-8');
    const baseProject = JSON.parse(baseProjectData);
    
    const configs = [
{ assemblies: 1, products: 1, name: 'original', iterations: 10 },
        { assemblies: 50, products: 20, name: 'medium', iterations: 10 },
        { assemblies: 1000, products: 1, name: 'medium-more-assemblies', iterations: 10 },
        { assemblies: 250, products: 20, name: 'large', iterations: 5 },
        { assemblies: 5000, products: 1, name: 'large-more-assemblies', iterations: 5 },
        { assemblies: 2500, products: 20, name: 'xl', iterations: 5 },
        { assemblies: 50000, products: 1, name: 'xl-more-assemblies', iterations: 5 },
    ];
    
    const results: any[] = [];
    
    for (const config of configs) {
        try {
            const result = await compareApproaches(baseProject, config);
            results.push(result);
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
            console.error(`Error comparing ${config.name}:`, error);
        }
    }
    
    printComparison(results);
    
    // Save results
    const resultsPath = path.join(__dirname, 'externref-comparison.json');
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n✅ Results saved to: ${resultsPath}`);
}

main().catch(console.error);
