import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.info('Seeding initial walking skeleton data...');

  // Clean existing sample data
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.product.deleteMany();
  await prisma.store.deleteMany();
  await prisma.user.deleteMany();

  // 1. Create Demo User with PIN 1234
  const pinHash = await bcrypt.hash('1234', 10);
  const user = await prisma.user.create({
    data: {
      phone: '+251911000000',
      pinHash,
    },
  });

  // 2. Create Demo Store
  const store = await prisma.store.create({
    data: {
      name: "Dawit's Kiosk",
      userId: user.id,
    },
  });

  // 3. Create Demo Products
  await prisma.product.createMany({
    data: [
      {
        storeId: store.id,
        name: 'Cooking Oil 1L',
        priceCents: 25000, // 250.00 ETB
        stock: 12,
        lowStockThreshold: 3,
      },
      {
        storeId: store.id,
        name: 'Mineral Water 500ml',
        priceCents: 2500, // 25.00 ETB
        stock: 24,
        lowStockThreshold: 5,
      },
      {
        storeId: store.id,
        name: 'Laundry Soap',
        priceCents: 5000, // 50.00 ETB
        stock: 4,
        lowStockThreshold: 5, // LOW STOCK!
      },
    ],
  });

  console.info('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
