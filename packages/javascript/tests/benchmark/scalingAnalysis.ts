import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateProject } from "../../src/lcax";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ScalingDataPoint {
    assemblies: number;
    products: number;
    totalProducts: number;
    avgTime: number;
    timePerProduct: number;
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

async function measureScaling(
    baseProject: any,
    assemblies: number,
    products: number,
    iterations: number = 5
): Promise<ScalingDataPoint> {
    const testProject = generateProject(assemblies, products, baseProject);
    const totalProducts = assemblies * products;
    
    // Warm up
    for (let i = 0; i < 2; i++) {
        calculateProject(JSON.parse(JSON.stringify(testProject)));
    }
    
    const times: number[] = [];
    for (let i = 0; i < iterations; i++) {
        const project = JSON.parse(JSON.stringify(testProject));
        const start = performance.now();
        calculateProject(project);
        const end = performance.now();
        times.push(end - start);
        
        process.stdout.write(`  ${assemblies}×${products}: iteration ${i + 1}/${iterations}\r`);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    
    return {
        assemblies,
        products,
        totalProducts,
        avgTime,
        timePerProduct: avgTime / totalProducts
    };
}

function analyzeComplexity(points: ScalingDataPoint[]) {
    console.log('\n' + '='.repeat(100));
    console.log('COMPLEXITY ANALYSIS');
    console.log('='.repeat(100));
    
    console.log('\nRaw Data:');
    console.log('─'.repeat(100));
    console.log('| Products | Assemblies | Prod/Asm | Time (ms) | Time/Product | Growth Rate |');
    console.log('|----------|------------|----------|-----------|--------------|-------------|');
    
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        let growthRate = '-';
        
        if (i > 0) {
            const prev = points[i - 1];
            const timeRatio = p.avgTime / prev.avgTime;
            const sizeRatio = p.totalProducts / prev.totalProducts;
            const complexity = Math.log(timeRatio) / Math.log(sizeRatio);
            growthRate = `${complexity.toFixed(2)} (O(n^${complexity.toFixed(1)}))`;
        }
        
        console.log(
            `| ${p.totalProducts.toString().padStart(8)} | ` +
            `${p.assemblies.toString().padStart(10)} | ` +
            `${p.products.toString().padStart(8)} | ` +
            `${p.avgTime.toFixed(2).padStart(9)} | ` +
            `${p.timePerProduct.toFixed(4).padStart(12)} | ` +
            `${growthRate.padStart(11)} |`
        );
    }
    
    // Estimate overall complexity
    if (points.length >= 3) {
        console.log('\n📈 Complexity Estimation:');
        console.log('─'.repeat(100));
        
        const complexities: number[] = [];
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const timeRatio = curr.avgTime / prev.avgTime;
            const sizeRatio = curr.totalProducts / prev.totalProducts;
            const complexity = Math.log(timeRatio) / Math.log(sizeRatio);
            complexities.push(complexity);
        }
        
        const avgComplexity = complexities.reduce((a, b) => a + b, 0) / complexities.length;
        
        console.log(`\nAverage complexity exponent: ${avgComplexity.toFixed(2)}`);
        console.log(`Estimated algorithm complexity: O(n^${avgComplexity.toFixed(2)})`);
        
        if (avgComplexity < 1.2) {
            console.log('✅ Nearly linear scaling - EXCELLENT!');
        } else if (avgComplexity < 1.5) {
            console.log('⚠️  Sub-quadratic but could be improved');
        } else if (avgComplexity < 2.2) {
            console.log('❌ Approaching quadratic - MAJOR BOTTLENECK!');
            console.log('   Likely causes:');
            console.log('   - Nested loops over products/assemblies');
            console.log('   - Linear search in collections');
            console.log('   - Repeated recalculation of shared data');
        } else {
            console.log('🚨 WORSE THAN QUADRATIC - CRITICAL ISSUE!');
            console.log('   Possible causes:');
            console.log('   - Triple nested loops');
            console.log('   - Exponential algorithm');
            console.log('   - Severe performance bug');
        }
    }
    
    // Check if time per product is increasing
    console.log('\n⏱️  Time Per Product Analysis:');
    console.log('─'.repeat(100));
    
    const firstTimePerProduct = points[0].timePerProduct;
    const lastTimePerProduct = points[points.length - 1].timePerProduct;
    const increase = (lastTimePerProduct / firstTimePerProduct - 1) * 100;
    
    console.log(`Time per product at ${points[0].totalProducts} products: ${firstTimePerProduct.toFixed(6)}ms`);
    console.log(`Time per product at ${points[points.length - 1].totalProducts} products: ${lastTimePerProduct.toFixed(6)}ms`);
    console.log(`Increase: ${increase.toFixed(1)}%`);
    
    if (increase > 50) {
        console.log('\n❌ Time per product increases significantly with scale!');
        console.log('   This confirms non-linear complexity.');
        console.log('   Each additional product takes longer to process.');
    } else if (increase > 10) {
        console.log('\n⚠️  Time per product shows some degradation');
        console.log('   May indicate cache misses or sub-optimal data structures');
    } else {
        console.log('\n✅ Time per product remains relatively constant');
        console.log('   This indicates good linear scaling');
    }
}

async function main() {
    console.log('LCAX Scaling & Complexity Analyzer');
    console.log('===================================\n');
    console.log('This tool analyzes how performance scales with data size');
    console.log('to estimate algorithm complexity (O(n), O(n²), etc.)\n');
    
    const baseProjectPath = path.join(__dirname, '../calculate/datafixtures/project.json');
    const baseProjectData = await fs.readFile(baseProjectPath, 'utf-8');
    const baseProject = JSON.parse(baseProjectData);
    
    // Test various sizes with fixed products-per-assembly ratio
    // This isolates the scaling behavior
    const testConfigs = [
        { assemblies: 1, products: 10 },
        { assemblies: 2, products: 10 },
        { assemblies: 5, products: 10 },
        { assemblies: 10, products: 10 },
        { assemblies: 20, products: 10 },
        { assemblies: 50, products: 10 },
        { assemblies: 100, products: 10 },
        { assemblies: 200, products: 10 },
    ];
    
    console.log('Running scaling tests (products per assembly = 10)...\n');
    
    const results: ScalingDataPoint[] = [];
    
    for (const config of testConfigs) {
        try {
            // Use fewer iterations for larger sizes
            const iterations = config.assemblies <= 10 ? 10 : config.assemblies <= 50 ? 5 : 3;
            
            const result = await measureScaling(
                baseProject,
                config.assemblies,
                config.products,
                iterations
            );
            results.push(result);
            
            console.log(
                `  ${config.assemblies}×${config.products}: ${result.avgTime.toFixed(2)}ms ` +
                `(${result.timePerProduct.toFixed(4)}ms per product)`
            );
            
            // Safety check - stop if taking too long
            if (result.avgTime > 60000) {
                console.log('\n⚠️  Stopping early - tests taking too long (>1 minute)');
                break;
            }
        } catch (error) {
            console.error(`\nError testing ${config.assemblies}×${config.products}:`, error);
            break;
        }
    }
    
    analyzeComplexity(results);
    
    // Save results
    const resultsPath = path.join(__dirname, 'scaling-analysis.json');
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n✅ Results saved to: ${resultsPath}`);
    
    // Provide recommendations
    console.log('\n' + '='.repeat(100));
    console.log('RECOMMENDATIONS');
    console.log('='.repeat(100));
    console.log('\nTo investigate further:');
    console.log('1. Profile the Rust code with cargo flamegraph');
    console.log('2. Look for nested iterations over products/assemblies');
    console.log('3. Check for O(n) lookups that could be O(1) with HashMap');
    console.log('4. Verify EPD data is not being re-processed repeatedly');
    console.log('5. Consider caching intermediate calculation results');
}

main().catch(console.error);
