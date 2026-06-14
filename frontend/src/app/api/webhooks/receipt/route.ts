import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { communicationId, status, timestamp } = await req.json();

    if (!communicationId || !status) {
      return NextResponse.json({ error: "Missing communicationId or status" }, { status: 400 });
    }

    // Update the communication log status based on the webhook from Channel Service
    const log = await prisma.communicationLog.update({
      where: { id: communicationId },
      data: { 
        status,
        updatedAt: timestamp ? new Date(timestamp) : new Date()
      }
    });

    console.log(`[Webhook Received] Communication ${communicationId} -> ${status}`);

    // SMART FALLBACK LOGIC
    if (status === 'FAILED' && log.channel !== 'sms') {
      console.log(`[Fallback Triggered] Communication ${communicationId} failed on ${log.channel}. Falling back to SMS.`);
      
      const fallbackChannel = 'sms';
      
      // Create a new log for the fallback attempt
      const fallbackLog = await prisma.communicationLog.create({
        data: {
          campaignId: log.campaignId,
          customerId: log.customerId,
          channel: fallbackChannel,
          status: 'PENDING',
          message: `[FALLBACK] ${log.message}` // Prefix to easily identify fallbacks in UI
        }
      });

      // Dispatch to channel service
      const CHANNEL_SERVICE_URL = process.env.CHANNEL_SERVICE_URL || 'http://localhost:4000/api/send';
      const CRM_WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/receipt` : 'http://localhost:3000/api/webhooks/receipt';

      fetch(CHANNEL_SERVICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: log.campaignId,
          communicationId: fallbackLog.id,
          recipientId: log.customerId,
          channel: fallbackChannel,
          message: fallbackLog.message,
          callbackUrl: CRM_WEBHOOK_URL
        })
      }).catch(err => console.error("Error dispatching fallback:", err));
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Webhook Receipt Error:", error);
    // If the record isn't found or another error occurs, we still return 200 
    // to acknowledge receipt to the mock service so it doesn't retry infinitely.
    return NextResponse.json({ error: error.message }, { status: 200 });
  }
}
