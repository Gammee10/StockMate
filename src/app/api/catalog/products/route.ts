import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const products = await db.product.findMany({
      where: { isArchived: false },
      include: {
        store: {
          select: { name: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      count: products.length,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
        priceEtb: (p.priceCents / 100).toFixed(2),
        stock: p.stock,
        lowStockThreshold: p.lowStockThreshold,
        isLowStock: p.stock <= p.lowStockThreshold,
        storeName: p.store.name,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch products:', error);
    return NextResponse.json(
      {
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to retrieve products from database',
        },
      },
      { status: 500 }
    );
  }
}
