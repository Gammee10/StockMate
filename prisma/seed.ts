import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateDemoData } from '../src/demo/demo-data';

export const DEMO_PHONE = '+251911000000';
export const DEMO_PIN = '1234';
export const DEMO_STORE_NAME = "Dawit's Kiosk";

/**
 * Checks if the seed script is permitted to run in the current environment.
 * If NODE_ENV is 'production', ALLOW_DEMO_SEED must explicitly be 'true'.
 */
export function checkProductionSeedGuard(env: {
  NODE_ENV?: string;
  ALLOW_DEMO_SEED?: string;
}): boolean {
  if (env.NODE_ENV === 'production' && env.ALLOW_DEMO_SEED !== 'true') {
    return false;
  }
  return true;
}

/**
 * Splits an array into chunks of the given size for batched insertions.
 */
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Scoped cleanup: Strictly removes only the demo user and its store data.
 * Foreign key restrict on SaleItem -> Product requires deleting sale items before products.
 */
export async function cleanDemoData(prisma: PrismaClient, phone: string = DEMO_PHONE) {
  const existingUser = await prisma.user.findUnique({
    where: { phone },
    include: { stores: true },
  });

  if (!existingUser) {
    return;
  }

  for (const store of existingUser.stores) {
    // 1. Delete stock movements
    await prisma.stockMovement.deleteMany({
      where: { storeId: store.id },
    });

    // 2. Delete sale items
    await prisma.saleItem.deleteMany({
      where: { sale: { storeId: store.id } },
    });

    // 3. Delete sales
    await prisma.sale.deleteMany({
      where: { storeId: store.id },
    });

    // 4. Delete products
    await prisma.product.deleteMany({
      where: { storeId: store.id },
    });

    // 5. Delete store
    await prisma.store.deleteMany({
      where: { id: store.id },
    });
  }

  // 6. Delete user
  await prisma.user.delete({
    where: { id: existingUser.id },
  });
}

/**
 * Populates realistic retail inventory and 30-day transaction history for the demo store.
 */
export async function seedDemoData(
  prisma: PrismaClient,
  options?: { now?: Date; seed?: number }
) {
  console.info(`Cleaning prior demo data for ${DEMO_PHONE}...`);
  await cleanDemoData(prisma, DEMO_PHONE);

  console.info('Creating demo user and store...');
  const pinHash = await bcrypt.hash(DEMO_PIN, 10);
  const user = await prisma.user.create({
    data: {
      phone: DEMO_PHONE,
      pinHash,
    },
  });

  const store = await prisma.store.create({
    data: {
      name: DEMO_STORE_NAME,
      userId: user.id,
    },
  });

  console.info(`Generating realistic demo dataset for store ${store.id}...`);
  const demoData = generateDemoData({
    storeId: store.id,
    now: options?.now,
    seed: options?.seed,
  });

  // Batch insert products
  console.info(`Inserting ${demoData.products.length} demo products...`);
  for (const batch of chunk(demoData.products, 100)) {
    await prisma.product.createMany({ data: batch });
  }

  // Batch insert sales (omitting nested items relation)
  console.info(`Inserting ${demoData.sales.length} demo sales...`);
  const salesWithoutItems = demoData.sales.map(({ items: _items, ...sale }) => sale);
  for (const batch of chunk(salesWithoutItems, 100)) {
    await prisma.sale.createMany({ data: batch });
  }

  // Batch insert sale items
  console.info(`Inserting ${demoData.saleItems.length} demo sale items...`);
  for (const batch of chunk(demoData.saleItems, 100)) {
    await prisma.saleItem.createMany({ data: batch });
  }

  // Batch insert stock movements
  console.info(`Inserting ${demoData.stockMovements.length} demo stock movements...`);
  for (const batch of chunk(demoData.stockMovements, 100)) {
    await prisma.stockMovement.createMany({ data: batch });
  }

  console.info('Demo seed completed successfully!');
  console.info(
    `Summary: ${demoData.summary.productCount} products, ${demoData.summary.saleCount} sales, ${demoData.summary.movementCount} stock movements.`
  );

  return { user, store, summary: demoData.summary };
}

async function main() {
  if (!checkProductionSeedGuard(process.env)) {
    console.error(
      'ABORT: Attempted to run demo seed script in production environment without explicit ALLOW_DEMO_SEED=true confirmation.'
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    await seedDemoData(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute when invoked directly via CLI (tsx prisma/seed.ts)
if (process.env.VITEST !== 'true' && process.env.NODE_ENV !== 'test') {
  main().catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  });
}
