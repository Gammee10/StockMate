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
  {
    id: 'p1',
    name: 'Sugar 1kg',
    priceCents: 12000,
    lowStockThreshold: 15,
    initialStock: 30,
    baseDailyDemand: 12.0,
  },
  {
    id: 'p2',
    name: 'Cooking Oil 1L',
    priceCents: 35000,
    lowStockThreshold: 12,
    initialStock: 25,
    baseDailyDemand: 10.0,
  },
  {
    id: 'p3',
    name: 'Teff Flour 5kg',
    priceCents: 50000,
    lowStockThreshold: 10,
    initialStock: 20,
    baseDailyDemand: 8.0,
  },
  {
    id: 'p4',
    name: 'Powdered Milk 400g',
    priceCents: 45000,
    lowStockThreshold: 8,
    initialStock: 18,
    baseDailyDemand: 7.0,
  },
  {
    id: 'p5',
    name: 'Laundry Soap Bar',
    priceCents: 4000,
    lowStockThreshold: 15,
    initialStock: 35,
    baseDailyDemand: 14.0,
  },
  {
    id: 'p6',
    name: 'Bottled Water 1L',
    priceCents: 3000,
    lowStockThreshold: 20,
    initialStock: 40,
    baseDailyDemand: 15.0,
  },

  // Medium sellers (moderate daily demand)
  {
    id: 'p7',
    name: 'Macaroni 500g',
    priceCents: 6500,
    lowStockThreshold: 6,
    initialStock: 15,
    baseDailyDemand: 4.5,
  },
  {
    id: 'p8',
    name: 'Iodized Salt 1kg',
    priceCents: 2500,
    lowStockThreshold: 6,
    initialStock: 15,
    baseDailyDemand: 5.0,
  },
  {
    id: 'p9',
    name: 'Black Tea 100g',
    priceCents: 8000,
    lowStockThreshold: 5,
    initialStock: 12,
    baseDailyDemand: 3.0,
  },
  {
    id: 'p10',
    name: 'Tomato Paste 400g',
    priceCents: 9000,
    lowStockThreshold: 5,
    initialStock: 12,
    baseDailyDemand: 4.0,
  },
  {
    id: 'p11',
    name: 'Red Lentils 1kg',
    priceCents: 16000,
    lowStockThreshold: 5,
    initialStock: 12,
    baseDailyDemand: 3.5,
  },
  {
    id: 'p12',
    name: 'Spaghetti 500g',
    priceCents: 7000,
    lowStockThreshold: 6,
    initialStock: 14,
    baseDailyDemand: 4.5,
  },
  {
    id: 'p13',
    name: 'Bath Soap',
    priceCents: 5000,
    lowStockThreshold: 6,
    initialStock: 15,
    baseDailyDemand: 5.0,
  },
  {
    id: 'p14',
    name: 'Biscuits Pack',
    priceCents: 3500,
    lowStockThreshold: 8,
    initialStock: 16,
    baseDailyDemand: 5.5,
  },

  // Slow sellers (niche / household maintenance)
  {
    id: 'p15',
    name: 'Mixed Spices 100g',
    priceCents: 11000,
    lowStockThreshold: 3,
    initialStock: 8,
    baseDailyDemand: 1.2,
  },
  {
    id: 'p16',
    name: 'Laundry Powder 1kg',
    priceCents: 22000,
    lowStockThreshold: 3,
    initialStock: 8,
    baseDailyDemand: 1.5,
  },
  {
    id: 'p17',
    name: 'Bleach 500ml',
    priceCents: 7500,
    lowStockThreshold: 2,
    initialStock: 6,
    baseDailyDemand: 0.8,
  },
  {
    id: 'p18',
    name: 'Steel Wool 3-pack',
    priceCents: 3000,
    lowStockThreshold: 2,
    initialStock: 6,
    baseDailyDemand: 1.0,
  },
  {
    id: 'p19',
    name: 'Toothpaste 100ml',
    priceCents: 15000,
    lowStockThreshold: 2,
    initialStock: 5,
    baseDailyDemand: 0.7,
  },
  {
    id: 'p20',
    name: 'Matches Pack',
    priceCents: 1500,
    lowStockThreshold: 4,
    initialStock: 10,
    baseDailyDemand: 1.8,
  },
];

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
