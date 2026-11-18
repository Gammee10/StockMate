/**
 * Pure, deterministic demo data generator for StockMate.
 * Produces realistic retail inventory, sales, and stock movement ledgers.
 *
 * NOTE: Do NOT use `@/` path aliases or database imports in this file
 * so that `tsx prisma/seed.ts` can load it directly via relative path.
 */

export interface DemoProduct {
  id: string;
  storeId: string;
  name: string;
  priceCents: number;
  costCents: number;
  stock: number;
  lowStockThreshold: number;
  isArchived: boolean;
  updatedAt: Date;
}

export interface DemoSaleItem {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPriceCents: number;
}

export interface DemoSale {
  id: string;
  storeId: string;
  totalAmountCents: number;
  paymentMethod: 'CASH' | 'DIGITAL';
  idempotencyKey: string;
  status: 'COMPLETED' | 'VOIDED';
  createdAt: Date;
  items: DemoSaleItem[];
}

export interface DemoStockMovement {
  id: string;
  storeId: string;
  productId: string;
  type: 'INITIAL' | 'SALE' | 'VOID_RESTORE' | 'RESTOCK' | 'ADJUSTMENT';
  quantityDelta: number;
  stockBefore: number;
  stockAfter: number;
  saleId: string | null;
  createdAt: Date;
}

export interface DemoDataOptions {
  seed?: number;
  now?: Date;
  storeId?: string;
}

export interface DemoDataResult {
  storeId: string;
  products: DemoProduct[];
  sales: DemoSale[];
  saleItems: DemoSaleItem[];
  stockMovements: DemoStockMovement[];
  summary: {
    productCount: number;
    saleCount: number;
    movementCount: number;
    fastSellerCount: number;
    deadStockCount: number;
    stockoutRecoveredCount: number;
    lowStockCurrentCount: number;
  };
}

/**
 * 32-bit Mulberry32 seeded pseudo-random number generator.
 * Produces uniform float in [0, 1).
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

type Archetype =
  'FAST_SELLER' | 'DEAD_STOCK' | 'STOCKOUT_RECOVERED' | 'LOW_STOCK_CURRENT' | 'NORMAL';

interface ProductBlueprint {
  name: string;
  priceCents: number;
  costRatio: number;
  lowStockThreshold: number;
  archetype: Archetype;
  initialStock: number;
  targetRestock: number;
}

const PRODUCT_BLUEPRINTS: ProductBlueprint[] = [
  // Fast Sellers (7 items)
  {
    name: 'White Rice 1kg',
    priceCents: 12000,
    costRatio: 0.82,
    lowStockThreshold: 10,
    archetype: 'FAST_SELLER',
    initialStock: 50,
    targetRestock: 45,
  },
  {
    name: 'Cooking Oil 1L',
    priceCents: 25000,
    costRatio: 0.86,
    lowStockThreshold: 10,
    archetype: 'FAST_SELLER',
    initialStock: 60,
    targetRestock: 50,
  },
  {
    name: 'Spaghetti Pasta 500g',
    priceCents: 7500,
    costRatio: 0.76,
    lowStockThreshold: 12,
    archetype: 'FAST_SELLER',
    initialStock: 55,
    targetRestock: 45,
  },
  {
    name: 'White Sugar 1kg',
    priceCents: 11000,
    costRatio: 0.84,
    lowStockThreshold: 12,
    archetype: 'FAST_SELLER',
    initialStock: 60,
    targetRestock: 50,
  },
  {
    name: 'Red Lentils 1kg',
    priceCents: 21000,
    costRatio: 0.85,
    lowStockThreshold: 10,
    archetype: 'FAST_SELLER',
    initialStock: 50,
    targetRestock: 40,
  },
  {
    name: 'Iodized Table Salt 1kg',
    priceCents: 3000,
    costRatio: 0.7,
    lowStockThreshold: 15,
    archetype: 'FAST_SELLER',
    initialStock: 70,
    targetRestock: 55,
  },
  {
    name: 'Laundry Bar Soap 200g',
    priceCents: 5000,
    costRatio: 0.74,
    lowStockThreshold: 12,
    archetype: 'FAST_SELLER',
    initialStock: 65,
    targetRestock: 50,
  },

  // Dead Stock (5 items)
  {
    name: 'Corn Flour 1kg',
    priceCents: 9000,
    costRatio: 0.78,
    lowStockThreshold: 5,
    archetype: 'DEAD_STOCK',
    initialStock: 16,
    targetRestock: 0,
  },
  {
    name: 'Barley Flour 1kg',
    priceCents: 9500,
    costRatio: 0.8,
    lowStockThreshold: 5,
    archetype: 'DEAD_STOCK',
    initialStock: 14,
    targetRestock: 0,
  },
  {
    name: 'Fava Beans 1kg',
    priceCents: 15000,
    costRatio: 0.82,
    lowStockThreshold: 5,
    archetype: 'DEAD_STOCK',
    initialStock: 12,
    targetRestock: 0,
  },
  {
    name: 'Cardamom Whole 50g',
    priceCents: 12500,
    costRatio: 0.8,
    lowStockThreshold: 4,
    archetype: 'DEAD_STOCK',
    initialStock: 10,
    targetRestock: 0,
  },
  {
    name: 'Cloves Whole 50g',
    priceCents: 11000,
    costRatio: 0.8,
    lowStockThreshold: 4,
    archetype: 'DEAD_STOCK',
    initialStock: 10,
    targetRestock: 0,
  },

  // Stockout & Recovered (4 items - experience 1 to 3 days stockout before weekly restock)
  {
    name: 'Chickpeas Split 1kg',
    priceCents: 16000,
    costRatio: 0.8,
    lowStockThreshold: 8,
    archetype: 'STOCKOUT_RECOVERED',
    initialStock: 14,
    targetRestock: 25,
  },
  {
    name: 'Yellow Split Peas 1kg',
    priceCents: 14000,
    costRatio: 0.8,
    lowStockThreshold: 8,
    archetype: 'STOCKOUT_RECOVERED',
    initialStock: 15,
    targetRestock: 25,
  },
  {
    name: 'Tomato Paste 400g',
    priceCents: 6500,
    costRatio: 0.76,
    lowStockThreshold: 8,
    archetype: 'STOCKOUT_RECOVERED',
    initialStock: 18,
    targetRestock: 30,
  },
  {
    name: 'Washing Powder 500g',
    priceCents: 13500,
    costRatio: 0.78,
    lowStockThreshold: 8,
    archetype: 'STOCKOUT_RECOVERED',
    initialStock: 16,
    targetRestock: 25,
  },

  // Low Stock Right Now (4 items - final stock ends up at 1..threshold)
  {
    name: 'Peanut Butter 400g',
    priceCents: 16000,
    costRatio: 0.82,
    lowStockThreshold: 5,
    archetype: 'LOW_STOCK_CURRENT',
    initialStock: 8,
    targetRestock: 5,
  },
  {
    name: 'Black Tea Loose 100g',
    priceCents: 6000,
    costRatio: 0.75,
    lowStockThreshold: 8,
    archetype: 'LOW_STOCK_CURRENT',
    initialStock: 10,
    targetRestock: 6,
  },
  {
    name: 'Herbal Shampoo 250ml',
    priceCents: 17500,
    costRatio: 0.78,
    lowStockThreshold: 5,
    archetype: 'LOW_STOCK_CURRENT',
    initialStock: 8,
    targetRestock: 4,
  },
  {
    name: 'Dishwashing Liquid 750ml',
    priceCents: 12000,
    costRatio: 0.78,
    lowStockThreshold: 6,
    archetype: 'LOW_STOCK_CURRENT',
    initialStock: 9,
    targetRestock: 5,
  },

  // Normal Staples (20 items)
  {
    name: 'White Teff Flour 5kg',
    priceCents: 52000,
    costRatio: 0.85,
    lowStockThreshold: 6,
    archetype: 'NORMAL',
    initialStock: 25,
    targetRestock: 20,
  },
  {
    name: 'Red Teff Flour 5kg',
    priceCents: 48000,
    costRatio: 0.84,
    lowStockThreshold: 6,
    archetype: 'NORMAL',
    initialStock: 25,
    targetRestock: 20,
  },
  {
    name: 'Wheat Flour 2kg',
    priceCents: 18000,
    costRatio: 0.8,
    lowStockThreshold: 8,
    archetype: 'NORMAL',
    initialStock: 30,
    targetRestock: 25,
  },
  {
    name: 'Long Grain Rice 2kg',
    priceCents: 24000,
    costRatio: 0.82,
    lowStockThreshold: 8,
    archetype: 'NORMAL',
    initialStock: 25,
    targetRestock: 20,
  },
  {
    name: 'Macaroni Pasta 500g',
    priceCents: 7500,
    costRatio: 0.76,
    lowStockThreshold: 10,
    archetype: 'NORMAL',
    initialStock: 35,
    targetRestock: 25,
  },
  {
    name: 'Instant Dry Yeast 100g',
    priceCents: 4500,
    costRatio: 0.72,
    lowStockThreshold: 6,
    archetype: 'NORMAL',
    initialStock: 25,
    targetRestock: 15,
  },
  {
    name: 'Baking Powder 100g',
    priceCents: 3500,
    costRatio: 0.74,
    lowStockThreshold: 5,
    archetype: 'NORMAL',
    initialStock: 20,
    targetRestock: 15,
  },
  {
    name: 'Wheat Crackers Pack',
    priceCents: 3000,
    costRatio: 0.75,
    lowStockThreshold: 8,
    archetype: 'NORMAL',
    initialStock: 25,
    targetRestock: 20,
  },
  {
    name: 'Brown Lentils 1kg',
    priceCents: 19000,
    costRatio: 0.83,
    lowStockThreshold: 6,
    archetype: 'NORMAL',
    initialStock: 25,
    targetRestock: 20,
  },
  {
    name: 'Sunflower Oil 2L',
    priceCents: 48000,
    costRatio: 0.86,
    lowStockThreshold: 6,
    archetype: 'NORMAL',
    initialStock: 20,
    targetRestock: 18,
  },
  {
    name: 'Roasted Coffee Beans 500g',
    priceCents: 32000,
    costRatio: 0.82,
    lowStockThreshold: 6,
    archetype: 'NORMAL',
    initialStock: 22,
    targetRestock: 18,
  },
  {
    name: 'Berbere Spice Blend 250g',
    priceCents: 14000,
    costRatio: 0.78,
    lowStockThreshold: 8,
    archetype: 'NORMAL',
    initialStock: 25,
    targetRestock: 20,
  },
  {
    name: 'Mitin Shiro Blend 500g',
    priceCents: 18000,
    costRatio: 0.8,
    lowStockThreshold: 8,
    archetype: 'NORMAL',
    initialStock: 25,
    targetRestock: 20,
  },
  {
    name: 'Body Soap Bar 150g',
    priceCents: 4500,
    costRatio: 0.75,
    lowStockThreshold: 10,
    archetype: 'NORMAL',
    initialStock: 35,
    targetRestock: 25,
  },
  {
    name: 'Fluoride Toothpaste 100ml',
    priceCents: 8500,
    costRatio: 0.72,
    lowStockThreshold: 6,
    archetype: 'NORMAL',
    initialStock: 25,
    targetRestock: 20,
  },
  {
    name: 'Adult Toothbrush Medium',
    priceCents: 3500,
    costRatio: 0.7,
    lowStockThreshold: 8,
    archetype: 'NORMAL',
    initialStock: 30,
    targetRestock: 20,
  },
  {
    name: 'Petroleum Jelly 100g',
    priceCents: 6500,
    costRatio: 0.74,
    lowStockThreshold: 6,
    archetype: 'NORMAL',
    initialStock: 25,
    targetRestock: 15,
  },
  {
    name: 'Liquid Bleach 1L',
    priceCents: 8000,
    costRatio: 0.75,
    lowStockThreshold: 8,
    archetype: 'NORMAL',
    initialStock: 25,
    targetRestock: 20,
  },
  {
    name: 'Matchboxes 10-Pack',
    priceCents: 2500,
    costRatio: 0.7,
    lowStockThreshold: 15,
    archetype: 'NORMAL',
    initialStock: 40,
    targetRestock: 30,
  },
  {
    name: 'White Candles 6-Pack',
    priceCents: 6000,
    costRatio: 0.72,
    lowStockThreshold: 10,
    archetype: 'NORMAL',
    initialStock: 30,
    targetRestock: 20,
  },
];

export function generateDemoData(options?: DemoDataOptions): DemoDataResult {
  const seed = options?.seed ?? 42;
  const now = options?.now ?? new Date('2026-11-19T00:00:00.000Z');
  const storeId = options?.storeId ?? 'demo_store_01';

  const prng = createPrng(seed);

  const MS_PER_DAY = 86_400_000;
  const windowStart = new Date(now.getTime() - 30 * MS_PER_DAY);

  // 1. Initialize Products
  const products: DemoProduct[] = [];
  const currentStockMap = new Map<string, number>();
  const stockMovements: DemoStockMovement[] = [];
  const sales: DemoSale[] = [];
  const saleItems: DemoSaleItem[] = [];

  let saleCounter = 0;
  let movementCounter = 0;
  let saleItemCounter = 0;

  PRODUCT_BLUEPRINTS.forEach((bp, index) => {
    const productId = `demo_prod_${String(index + 1).padStart(2, '0')}`;
    const costCents = Math.round(bp.priceCents * bp.costRatio);

    products.push({
      id: productId,
      storeId,
      name: bp.name,
      priceCents: bp.priceCents,
      costCents,
      stock: bp.initialStock,
      lowStockThreshold: bp.lowStockThreshold,
      isArchived: false,
      updatedAt: now,
    });

    currentStockMap.set(productId, bp.initialStock);

    // Initial movement 30 days ago
    movementCounter++;
    stockMovements.push({
      id: `demo_mvmt_${String(movementCounter).padStart(5, '0')}`,
      storeId,
      productId,
      type: 'INITIAL',
      quantityDelta: bp.initialStock,
      stockBefore: 0,
      stockAfter: bp.initialStock,
      saleId: null,
      createdAt: new Date(windowStart.getTime() + 1000 + index * 10),
    });
  });

  // Helper to record stock movement
  function applyStockDelta(
    productId: string,
    type: 'SALE' | 'RESTOCK',
    delta: number,
    saleId: string | null,
    createdAt: Date
  ) {
    const before = currentStockMap.get(productId) ?? 0;
    const after = before + delta;
    currentStockMap.set(productId, after);

    movementCounter++;
    const movement: DemoStockMovement = {
      id: `demo_mvmt_${String(movementCounter).padStart(5, '0')}`,
      storeId,
      productId,
      type,
      quantityDelta: delta,
      stockBefore: before,
      stockAfter: after,
      saleId,
      createdAt,
    };
    stockMovements.push(movement);
    return movement;
  }

  // Pre-identify product groups by archetype
  const fastSellerProducts = products.filter(
    (_, i) => PRODUCT_BLUEPRINTS[i].archetype === 'FAST_SELLER'
  );
  const normalProducts = products.filter(
    (_, i) => PRODUCT_BLUEPRINTS[i].archetype === 'NORMAL'
  );
  const stockoutProducts = products.filter(
    (_, i) => PRODUCT_BLUEPRINTS[i].archetype === 'STOCKOUT_RECOVERED'
  );
  const lowStockProducts = products.filter(
    (_, i) => PRODUCT_BLUEPRINTS[i].archetype === 'LOW_STOCK_CURRENT'
  );

  // Define exact stockout schedules for the 4 stockout items
  // item 0: runs out day 5, restocked day 7 (gap ~44h = 1.83 days)
  // item 1: runs out day 12, restocked day 14 (gap ~47h = 1.95 days)
  // item 2: runs out day 19, restocked day 21 (gap ~42h = 1.75 days)
  // item 3: runs out day 26, restocked day 28 (gap ~48h = 2.0 days)
  const stockoutSchedules = [
    { outDay: 5, outHour: 14, restockDay: 7, restockHour: 10, restockQty: 30 },
    { outDay: 12, outHour: 11, restockDay: 14, restockHour: 10, restockQty: 25 },
    { outDay: 19, outHour: 16, restockDay: 21, restockHour: 10, restockQty: 35 },
    { outDay: 26, outHour: 10, restockDay: 28, restockHour: 10, restockQty: 30 },
  ];

  // 2. Simulate 30 days of sales and weekly supplier restocks
  for (let day = 0; day < 30; day++) {
    const dayStart = new Date(windowStart.getTime() + day * MS_PER_DAY);
    const dayOfWeek = dayStart.getUTCDay(); // 0: Sunday, 6: Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // A. Weekly Restock Trips on days 7, 14, 21, 28 at 10:00 AM
    if (day === 7 || day === 14 || day === 21 || day === 28) {
      const restockTime = new Date(dayStart.getTime() + 10 * 3600_000);

      // Restock Fast Sellers
      for (const p of fastSellerProducts) {
        const bp = PRODUCT_BLUEPRINTS.find((b) => b.name === p.name)!;
        applyStockDelta(p.id, 'RESTOCK', bp.targetRestock, null, restockTime);
      }

      // Restock Normal staples if stock is moderate
      for (const p of normalProducts) {
        const bp = PRODUCT_BLUEPRINTS.find((b) => b.name === p.name)!;
        const current = currentStockMap.get(p.id) ?? 0;
        if (current < 25) {
          applyStockDelta(p.id, 'RESTOCK', bp.targetRestock, null, restockTime);
        }
      }

      // Restock scheduled stockout item
      stockoutSchedules.forEach((sched, idx) => {
        if (sched.restockDay === day) {
          const targetItem = stockoutProducts[idx];
          if (targetItem) {
            applyStockDelta(
              targetItem.id,
              'RESTOCK',
              sched.restockQty,
              null,
              new Date(dayStart.getTime() + sched.restockHour * 3600_000)
            );
          }
        }
      });

      // Low stock current items are restocked on days 7, 14, 21, but NOT on day 28
      // so that they remain low stock right now at day 30!
      if (day < 28) {
        for (const p of lowStockProducts) {
          const bp = PRODUCT_BLUEPRINTS.find((b) => b.name === p.name)!;
          applyStockDelta(p.id, 'RESTOCK', bp.targetRestock, null, restockTime);
        }
      }
    }

    // B. Check for scheduled stockout triggers on specific days
    stockoutSchedules.forEach((sched, idx) => {
      if (sched.outDay === day) {
        const targetItem = stockoutProducts[idx];
        if (targetItem) {
          const currStock = currentStockMap.get(targetItem.id) ?? 0;
          if (currStock > 0) {
            // Deplete remaining stock via a sale at sched.outHour
            const outTime = new Date(dayStart.getTime() + sched.outHour * 3600_000);
            saleCounter++;
            const saleId = `demo_sale_${String(saleCounter).padStart(5, '0')}`;
            saleItemCounter++;
            const saleItemId = `demo_sitem_${String(saleItemCounter).padStart(5, '0')}`;

            const saleItem: DemoSaleItem = {
              id: saleItemId,
              saleId,
              productId: targetItem.id,
              quantity: currStock,
              unitPriceCents: targetItem.priceCents,
            };
            saleItems.push(saleItem);

            applyStockDelta(targetItem.id, 'SALE', -currStock, saleId, outTime);

            sales.push({
              id: saleId,
              storeId,
              totalAmountCents: currStock * targetItem.priceCents,
              paymentMethod: prng() < 0.6 ? 'CASH' : 'DIGITAL',
              idempotencyKey: `demo_idem_${String(saleCounter).padStart(5, '0')}`,
              status: 'COMPLETED',
              createdAt: outTime,
              items: [saleItem],
            });
          }
        }
      }
    });

    // C. Regular daily sales transactions (spread between 08:00 and 20:00)
    // Weekends: 22-28 sales. Weekdays: 12-16 sales.
    const baseTxCount = isWeekend
      ? 22 + Math.floor(prng() * 7)
      : 12 + Math.floor(prng() * 5);

    for (let tx = 0; tx < baseTxCount; tx++) {
      // Time evenly spread with slight jitter
      const minuteOffset = Math.floor((tx / baseTxCount) * 12 * 60 + prng() * 15);
      const saleTime = new Date(dayStart.getTime() + (8 * 60 + minuteOffset) * 60_000);

      // Basket size: 1 to 4 items (weighted towards 1-2 items)
      const basketRoll = prng();
      const basketSize =
        basketRoll < 0.5 ? 1 : basketRoll < 0.8 ? 2 : basketRoll < 0.95 ? 3 : 4;

      const basketItems: DemoSaleItem[] = [];
      const chosenProductIds = new Set<string>();

      for (let b = 0; b < basketSize; b++) {
        // Choose candidate product based on archetype weights
        // Fast sellers: high weight (0.50)
        // Normal: moderate weight (0.35)
        // Low stock: low weight (0.10)
        // Stockout recovered (if in stock): low weight (0.05)
        // Dead stock: weight 0 (never chosen)
        const categoryRoll = prng();
        let candidatePool: DemoProduct[];

        if (categoryRoll < 0.48) {
          candidatePool = fastSellerProducts;
        } else if (categoryRoll < 0.72) {
          candidatePool = normalProducts;
        } else if (categoryRoll < 0.9) {
          candidatePool = lowStockProducts;
        } else {
          candidatePool = stockoutProducts;
        }

        const candidate = candidatePool[Math.floor(prng() * candidatePool.length)];
        if (!candidate || chosenProductIds.has(candidate.id)) continue;

        const currentStock = currentStockMap.get(candidate.id) ?? 0;
        if (currentStock <= 0) continue;

        // For STOCKOUT_RECOVERED products, do not let casual sales deplete them before their scheduled outDay
        if (candidatePool === stockoutProducts) {
          const schedIndex = stockoutProducts.findIndex((p) => p.id === candidate.id);
          const sched = stockoutSchedules[schedIndex];
          if (sched && day < sched.outDay && currentStock <= 4) {
            continue;
          }
        }

        // For LOW_STOCK_CURRENT products, preserve at least 1 unit so it is low stock (not out of stock)
        if (candidatePool === lowStockProducts && currentStock <= 1) {
          continue;
        }

        // Quantity: 1 to 3 units, capped at current stock
        // For low stock items, leave at least 1 unit in stock
        const maxQty =
          candidatePool === lowStockProducts
            ? Math.min(2, currentStock - 1)
            : Math.min(3, currentStock);

        const qtyRoll = prng();
        const desiredQty = qtyRoll < 0.7 ? 1 : qtyRoll < 0.9 ? 2 : 3;
        const finalQty = Math.min(desiredQty, maxQty);

        if (finalQty > 0) {
          chosenProductIds.add(candidate.id);
          saleItemCounter++;
          basketItems.push({
            id: `demo_sitem_${String(saleItemCounter).padStart(5, '0')}`,
            saleId: '', // populated below
            productId: candidate.id,
            quantity: finalQty,
            unitPriceCents: candidate.priceCents,
          });
        }
      }

      if (basketItems.length === 0) continue;

      saleCounter++;
      const saleId = `demo_sale_${String(saleCounter).padStart(5, '0')}`;
      let totalAmountCents = 0;

      for (const item of basketItems) {
        item.saleId = saleId;
        totalAmountCents += item.quantity * item.unitPriceCents;
        saleItems.push(item);
        applyStockDelta(item.productId, 'SALE', -item.quantity, saleId, saleTime);
      }

      // Payment method: ~60% CASH, ~40% DIGITAL
      const paymentMethod: 'CASH' | 'DIGITAL' = prng() < 0.6 ? 'CASH' : 'DIGITAL';

      sales.push({
        id: saleId,
        storeId,
        totalAmountCents,
        paymentMethod,
        idempotencyKey: `demo_idem_${String(saleCounter).padStart(5, '0')}`,
        status: 'COMPLETED',
        createdAt: saleTime,
        items: basketItems,
      });
    }
  }

  // 3. Update final product stocks from currentStockMap
  for (const product of products) {
    product.stock = currentStockMap.get(product.id) ?? 0;
  }

  // 4. Calculate summary stats
  const unitsSoldByProduct = new Map<string, number>();
  for (const item of saleItems) {
    unitsSoldByProduct.set(
      item.productId,
      (unitsSoldByProduct.get(item.productId) ?? 0) + item.quantity
    );
  }

  const fastSellerCount = products.filter(
    (p) => (unitsSoldByProduct.get(p.id) ?? 0) >= 60
  ).length;

  const deadStockCount = products.filter(
    (p) => (unitsSoldByProduct.get(p.id) ?? 0) === 0
  ).length;

  const lowStockCurrentCount = products.filter(
    (p) => p.stock > 0 && p.stock <= p.lowStockThreshold
  ).length;

  // Count products that experienced 1-3 days out-of-stock
  let stockoutRecoveredCount = 0;
  for (const product of products) {
    const pMovements = stockMovements
      .filter((m) => m.productId === product.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    let zeroSince: number | null = null;
    let had1To3DaysStockout = false;

    for (const m of pMovements) {
      if (m.stockAfter === 0 && zeroSince === null) {
        zeroSince = m.createdAt.getTime();
      } else if (m.stockBefore === 0 && m.stockAfter > 0 && zeroSince !== null) {
        const durationDays = (m.createdAt.getTime() - zeroSince) / MS_PER_DAY;
        if (durationDays >= 1.0 && durationDays <= 3.5) {
          had1To3DaysStockout = true;
        }
        zeroSince = null;
      }
    }
    if (had1To3DaysStockout) {
      stockoutRecoveredCount++;
    }
  }

  return {
    storeId,
    products,
    sales,
    saleItems,
    stockMovements,
    summary: {
      productCount: products.length,
      saleCount: sales.length,
      movementCount: stockMovements.length,
      fastSellerCount,
      deadStockCount,
      stockoutRecoveredCount,
      lowStockCurrentCount,
    },
  };
}
