import { describe, it, expect } from 'vitest';
import { calculateProductVelocity, calculateRecommendedOrder } from './service';

/**
 * 32-bit Mulberry32 seeded pseudo-random number generator.
 * Produces deterministic uniform float in [0, 1).
 */
function createPrng(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Knuth Poisson sampling for realistic discrete customer demand.
 */
function samplePoisson(lambda: number, prng: () => number): number {
  if (lambda <= 0) return 0;
  if (lambda > 30) {
    // Normal approximation for larger lambda
    const u1 = Math.max(1e-10, prng());
    const u2 = prng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * z));
  }
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= prng();
  } while (p > L);
  return k - 1;
}

interface ProductArchetype {
  id: string;
  name: string;
  priceCents: number;
  lowStockThreshold: number;
  initialStock: number;
  baseDailyDemand: number;
}

// 20 realistic retail products representing diverse velocity profiles
const SIMULATION_PRODUCTS: ProductArchetype[] = [
  // Fast sellers (high daily demand staples)
  ['p1', 'Sugar 1kg', 12000, 15, 30, 12.0],
  ['p2', 'Cooking Oil 1L', 35000, 12, 25, 10.0],
  ['p3', 'Teff Flour 5kg', 50000, 10, 20, 8.0],
  ['p4', 'Powdered Milk 400g', 45000, 8, 18, 7.0],
  ['p5', 'Laundry Soap Bar', 4000, 15, 35, 14.0],
  ['p6', 'Bottled Water 1L', 3000, 20, 40, 15.0],
  // Medium sellers (moderate daily demand)
  ['p7', 'Macaroni 500g', 6500, 6, 15, 4.5],
  ['p8', 'Iodized Salt 1kg', 2500, 6, 15, 5.0],
  ['p9', 'Black Tea 100g', 8000, 5, 12, 3.0],
  ['p10', 'Tomato Paste 400g', 9000, 5, 12, 4.0],
  ['p11', 'Red Lentils 1kg', 16000, 5, 12, 3.5],
  ['p12', 'Spaghetti 500g', 7000, 6, 14, 4.5],
  ['p13', 'Bath Soap', 5000, 6, 15, 5.0],
  ['p14', 'Biscuits Pack', 3500, 8, 16, 5.5],
  // Slow sellers (niche / household maintenance)
  ['p15', 'Mixed Spices 100g', 11000, 3, 8, 1.2],
  ['p16', 'Laundry Powder 1kg', 22000, 3, 8, 1.5],
  ['p17', 'Bleach 500ml', 7500, 2, 6, 0.8],
  ['p18', 'Steel Wool 3-pack', 3000, 2, 6, 1.0],
  ['p19', 'Toothpaste 100ml', 15000, 2, 5, 0.7],
  ['p20', 'Matches Pack', 1500, 4, 10, 1.8],
].map(([id, name, priceCents, lowStockThreshold, initialStock, baseDailyDemand]) => ({
  id: id as string,
  name: name as string,
  priceCents: priceCents as number,
  lowStockThreshold: lowStockThreshold as number,
  initialStock: initialStock as number,
  baseDailyDemand: baseDailyDemand as number,
}));

interface SimulationRunMetrics {
  totalDemand: number;
  totalSales: number;
  totalLostSales: number;
  lostSalesRatePct: number;
  averageDailyStockHeld: number;
}

/**
 * Generates an identical 90-day matrix of daily consumer demand across all 20 products.
 * Includes weekend surges (Saturday/Sunday 40% traffic boost).
 */
function generateDemandMatrix(seed: number, days = 90): Map<string, number[]> {
  const prng = createPrng(seed);
  const demandMatrix = new Map<string, number[]>();

  for (const product of SIMULATION_PRODUCTS) {
    const dailyDemand: number[] = [];
    for (let day = 1; day <= days; day++) {
      // Day 6 and 7 of every 7-day week are weekends
      const isWeekend = day % 7 === 6 || day % 7 === 0;
      const dayMultiplier = isWeekend ? 1.4 : 0.84;
      const expectedDailyDemand = product.baseDailyDemand * dayMultiplier;
      const demand = samplePoisson(expectedDailyDemand, prng);
      dailyDemand.push(demand);
    }
    demandMatrix.set(product.id, dailyDemand);
  }

  return demandMatrix;
}

/**
 * Simulates 90 retail operating days under Policy A (Naive static threshold).
 * At each 7-day supplier visit:
 * If stock <= lowStockThreshold, order up to 3 * lowStockThreshold.
 */
function simulatePolicyA(
  demandMatrix: Map<string, number[]>,
  days = 90
): SimulationRunMetrics {
  let totalDemand = 0;
  let totalSales = 0;
  let totalLostSales = 0;
  let cumulativeDailyStockSum = 0;

  for (const product of SIMULATION_PRODUCTS) {
    let currentStock = product.initialStock;
    const productDemand = demandMatrix.get(product.id)!;

    for (let day = 1; day <= days; day++) {
      // Merchant visits supplier every 7 days (day 7, 14, 21, ...)
      if (day % 7 === 0) {
        if (currentStock <= product.lowStockThreshold) {
          const targetStock = 3 * product.lowStockThreshold;
          const orderQty = Math.max(0, targetStock - currentStock);
          currentStock += orderQty;
        }
      }

      const demand = productDemand[day - 1];
      totalDemand += demand;

      const sales = Math.min(currentStock, demand);
      const lost = demand - sales;

      currentStock -= sales;
      totalSales += sales;
      totalLostSales += lost;
      cumulativeDailyStockSum += currentStock;
    }
  }

  const totalProductDays = SIMULATION_PRODUCTS.length * days;
  return {
    totalDemand,
    totalSales,
    totalLostSales,
    lostSalesRatePct: Number(((totalLostSales / totalDemand) * 100).toFixed(2)),
    averageDailyStockHeld: Number(
      (cumulativeDailyStockSum / totalProductDays).toFixed(2)
    ),
  };
}

/**
 * Simulates 90 retail operating days under Policy B (StockMate Velocity-Driven).
 * At each 7-day supplier visit:
 * Computes trailing 14-day velocity using calculateProductVelocity (with in-stock adjustments)
 * and orders recommended quantity using calculateRecommendedOrder with targetDays = 9 (7 visit gap + 2 safety).
 */
function simulatePolicyB(
  demandMatrix: Map<string, number[]>,
  days = 90
): SimulationRunMetrics {
  let totalDemand = 0;
  let totalSales = 0;
  let totalLostSales = 0;
  let cumulativeDailyStockSum = 0;

  for (const product of SIMULATION_PRODUCTS) {
    let currentStock = product.initialStock;
    const productDemand = demandMatrix.get(product.id)!;

    // Track daily sales and in-stock days for the trailing window calculation
    const dailyActualSales: number[] = [];
    const dailyInStockStatus: boolean[] = [];

    for (let day = 1; day <= days; day++) {
      // Merchant visits supplier every 7 days (day 7, 14, 21, ...)
      if (day % 7 === 0) {
        // Trailing window up to 14 days
        const availableHistoryDays = day - 1;
        const windowDays = Math.min(14, availableHistoryDays);
        const startIndex = availableHistoryDays - windowDays;

        let windowUnitsSold = 0;
        let windowInStockDays = 0;

        for (let i = startIndex; i < availableHistoryDays; i++) {
          windowUnitsSold += dailyActualSales[i];
          if (dailyInStockStatus[i]) {
            windowInStockDays++;
          }
        }

        const metrics = calculateProductVelocity(
          {
            id: product.id,
            name: product.name,
            priceCents: product.priceCents,
            stock: currentStock,
            lowStockThreshold: product.lowStockThreshold,
          },
          [{ quantity: windowUnitsSold, unitPriceCents: product.priceCents }],
          windowDays,
          9, // targetSupplyDays = 7 (visit gap) + 2 (safety buffer)
          windowInStockDays
        );

        const orderQty = calculateRecommendedOrder(
          currentStock,
          product.lowStockThreshold,
          metrics.salesVelocityPerDay,
          9
        );
        currentStock += orderQty;
      }

      const demand = productDemand[day - 1];
      totalDemand += demand;

      const hadStockStartOfDay = currentStock > 0;
      dailyInStockStatus.push(hadStockStartOfDay);

      const sales = Math.min(currentStock, demand);
      const lost = demand - sales;

      currentStock -= sales;
      dailyActualSales.push(sales);

      totalSales += sales;
      totalLostSales += lost;
      cumulativeDailyStockSum += currentStock;
    }
  }

  const totalProductDays = SIMULATION_PRODUCTS.length * days;
  return {
    totalDemand,
    totalSales,
    totalLostSales,
    lostSalesRatePct: Number(((totalLostSales / totalDemand) * 100).toFixed(2)),
    averageDailyStockHeld: Number(
      (cumulativeDailyStockSum / totalProductDays).toFixed(2)
    ),
  };
}

describe('Reorder Simulation (Task 1.8)', () => {
  it('demonstrates StockMate velocity replenishment outperforms naive reordering across 20 seeds', () => {
    const NUM_SEEDS = 20;
    const SIMULATION_DAYS = 90;
    const seeds = Array.from({ length: NUM_SEEDS }, (_, i) => 101 + i);

    const resultsA: SimulationRunMetrics[] = [];
    const resultsB: SimulationRunMetrics[] = [];

    for (const seed of seeds) {
      const demandMatrix = generateDemandMatrix(seed, SIMULATION_DAYS);
      const metricsA = simulatePolicyA(demandMatrix, SIMULATION_DAYS);
      const metricsB = simulatePolicyB(demandMatrix, SIMULATION_DAYS);

      resultsA.push(metricsA);
      resultsB.push(metricsB);
    }

    // Compute averages across all 20 simulation runs
    const avgA = {
      lostSales: resultsA.reduce((sum, r) => sum + r.totalLostSales, 0) / NUM_SEEDS,
      lostSalesRatePct:
        resultsA.reduce((sum, r) => sum + r.lostSalesRatePct, 0) / NUM_SEEDS,
      averageDailyStockHeld:
        resultsA.reduce((sum, r) => sum + r.averageDailyStockHeld, 0) / NUM_SEEDS,
    };

    const avgB = {
      lostSales: resultsB.reduce((sum, r) => sum + r.totalLostSales, 0) / NUM_SEEDS,
      lostSalesRatePct:
        resultsB.reduce((sum, r) => sum + r.lostSalesRatePct, 0) / NUM_SEEDS,
      averageDailyStockHeld:
        resultsB.reduce((sum, r) => sum + r.averageDailyStockHeld, 0) / NUM_SEEDS,
    };

    const lostSalesReductionPct = (
      ((avgA.lostSales - avgB.lostSales) / avgA.lostSales) *
      100
    ).toFixed(1);

    // Print clear summary table for documentation & portfolio
    console.info(
      '\n========================================================================'
    );
    console.info('      REORDER SIMULATION RESULTS: 90 DAYS, 20 PRODUCTS, 20 SEEDS');
    console.info(
      '========================================================================'
    );
    console.info(
      'Metric                          | Policy A (Naive) | Policy B (StockMate) | Delta / Improvement'
    );
    console.info(
      '--------------------------------+------------------+----------------------+--------------------'
    );
    console.info(
      `Mean Lost Sales (units)         | ${avgA.lostSales.toFixed(1).padEnd(16)} | ${avgB.lostSales.toFixed(1).padEnd(20)} | -${lostSalesReductionPct}% lost sales`
    );
    console.info(
      `Lost Sales Rate (% of demand)   | ${(avgA.lostSalesRatePct.toFixed(2) + '%').padEnd(16)} | ${(avgB.lostSalesRatePct.toFixed(2) + '%').padEnd(20)} | -${(avgA.lostSalesRatePct - avgB.lostSalesRatePct).toFixed(2)} pp`
    );
    console.info(
      `Avg Daily Stock Held (units)    | ${avgA.averageDailyStockHeld.toFixed(2).padEnd(16)} | ${avgB.averageDailyStockHeld.toFixed(2).padEnd(20)} | ${avgB.averageDailyStockHeld > avgA.averageDailyStockHeld ? '+' : ''}${(avgB.averageDailyStockHeld - avgA.averageDailyStockHeld).toFixed(2)} units/product`
    );
    console.info(
      '========================================================================\n'
    );

    // Determinism check: seed 101 must produce identical output when rerun
    const rerunDemandMatrix = generateDemandMatrix(101, SIMULATION_DAYS);
    const rerunA = simulatePolicyA(rerunDemandMatrix, SIMULATION_DAYS);
    const rerunB = simulatePolicyB(rerunDemandMatrix, SIMULATION_DAYS);

    expect(rerunA).toEqual(resultsA[0]);
    expect(rerunB).toEqual(resultsB[0]);

    // Primary assertion: StockMate (Policy B) achieves lower lost sales than naive threshold (Policy A)
    expect(avgB.lostSales).toBeLessThan(avgA.lostSales);
  });
});
