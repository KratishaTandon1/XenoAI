import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// The URL of our mock channel service
const CHANNEL_SERVICE_URL = process.env.CHANNEL_SERVICE_URL || 'http://localhost:4000/api/send';
// Note: In production this would be the actual deployed CRM domain
const CRM_WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/receipt` : 'http://localhost:3000/api/webhooks/receipt';

export async function POST(req: Request) {
  try {
    const { intent, sqlQuery, messageBody, channel, name } = await req.json();

    // 1. Fetch the audience using the AI-generated SQL query BEFORE creating the new campaign
    // This is critical because if the query depends on "the last campaign", creating a new one first breaks it!
    const audience = await prisma.$queryRawUnsafe<any[]>(sqlQuery);

    if (!audience || audience.length === 0) {
      return NextResponse.json({ error: "Audience is empty. Cannot send campaign." }, { status: 400 });
    }

    // 2. Create a new campaign record
    const campaign = await prisma.campaign.create({
      data: {
        name: name || 'New AI Campaign',
        audienceQuery: sqlQuery,
        messageBody,
        channel,
        status: 'executing'
      }
    });

    // 3. Create CommunicationLogs and dispatch to Channel Service
    let count = 0;
    for (const row of audience) {
      const customerId = row.id;

      const customer = await prisma.customer.findUnique({
        where: { id: customerId }
      });

      if (!customer) continue;

      // Personalize the message
      const personalizedMessage = messageBody.replace(/{{name}}/gi, customer.name);

      // Create a pending communication log
      const log = await prisma.communicationLog.create({
        data: {
          campaignId: campaign.id,
          customerId,
          channel,
          status: 'PENDING',
          message: personalizedMessage
        }
      });

      // Send to the channel service (fire and forget, so we don't await)
      fetch(CHANNEL_SERVICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
          communicationId: log.id,
          recipientId: customerId,
          channel,
          message: personalizedMessage,
          callbackUrl: CRM_WEBHOOK_URL
        })
      }).catch(err => console.error("Error dispatching to channel service:", err));

      count++;
    }

    // Mark campaign as completed (dispatch complete)
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'completed' }
    });

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      messagesDispatched: count
    });

  } catch (error: any) {
    console.error("Send Campaign Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
