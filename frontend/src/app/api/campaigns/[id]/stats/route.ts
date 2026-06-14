import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // In Next.js 15, route segment params are often treated as promises if accessed dynamically
    // but in Page Router / App Router basic setup we can usually destructure or await.
    // We'll await params just to be safe with Next.js 15.
    const { id } = await params;
    
    const stats = await prisma.communicationLog.groupBy({
      by: ['status'],
      where: { campaignId: id },
      _count: true
    });

    let total = 0;
    const rawStats: Record<string, number> = {};
    stats.forEach(s => {
      rawStats[s.status] = s._count;
      total += s._count;
    });

    // Funnel logic: The DB overwrites status, so CLICKED means it was also OPENED and DELIVERED.
    // FAILED is terminal and separate.
    const clicked = rawStats['CLICKED'] || 0;
    const openedOnly = rawStats['OPENED'] || 0;
    const deliveredOnly = rawStats['DELIVERED'] || 0;
    const failed = rawStats['FAILED'] || 0;

    const formattedStats = {
      PENDING: rawStats['PENDING'] || 0,
      CLICKED: clicked,
      OPENED: openedOnly + clicked,
      DELIVERED: deliveredOnly + openedOnly + clicked,
      FAILED: failed
    };

    const recentLogs = await prisma.communicationLog.findMany({
      where: { campaignId: id, status: { not: 'PENDING' } },
      orderBy: { updatedAt: 'desc' },
      take: 6,
      include: {
        customer: {
          select: { name: true }
        }
      }
    });

    return NextResponse.json({
      campaignId: id,
      total,
      stats: formattedStats,
      recentLogs
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
