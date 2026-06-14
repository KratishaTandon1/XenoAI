import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GoogleGenAI will be initialized inside the POST handler

const schema = {
  type: Type.OBJECT,
  properties: {
    sqlQuery: {
      type: Type.STRING,
      description: "A valid SQLite query returning a single column named 'id' from the Customer table. E.g. SELECT DISTINCT Customer.id FROM Customer JOIN `Order` ON Customer.id = `Order`.customerId WHERE `Order`.amount > 50"
    },
    messageVariants: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "An array of exactly 2 message variants. Use {{name}} to insert the customer's name. One variant should be professional, the other casual with emojis."
    },
    channel: {
      type: Type.STRING,
      description: "The communication channel to use: 'whatsapp', 'sms', or 'email'."
    }
  },
  required: ["sqlQuery", "messageVariants", "channel"],
};

export async function POST(req: Request) {
  try {
    const { intent } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }
    
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `
You are an intelligent AI agent inside a marketing CRM. Your job is to translate a user's natural language goal into a database query and personalized marketing messages.

Here is the SQLite Database Schema you must query:
Table Customer: id (String), name (String), email (String), phone (String), createdAt (DateTime)
Table \`Order\`: id (String), customerId (String), amount (Float), status (String), createdAt (DateTime)
Table Campaign: id (String), name (String), audienceQuery (String), channel (String), status (String), createdAt (DateTime)
Table CommunicationLog: id (String), campaignId (String), customerId (String), channel (String), status (String), message (String), createdAt (DateTime), updatedAt (DateTime)
(CRITICAL STATUS RULES: The status column ONLY stores the final, terminal state for a user. 
- To target users who "did not open", query for: status IN ('PENDING', 'DELIVERED', 'FAILED').
- To target users who "opened but did not click", query for: status = 'OPENED'.
- To target users who "clicked", query for: status = 'CLICKED'.

CRITICAL JOIN RULES:
If the user asks to target based on past engagement (like "opened but did not click"), you MUST join CommunicationLog and filter by the most recent campaign.
Example Query for "opened but did not click":
SELECT DISTINCT Customer.id FROM Customer JOIN CommunicationLog ON Customer.id = CommunicationLog.customerId WHERE CommunicationLog.campaignId = (SELECT id FROM Campaign ORDER BY createdAt DESC LIMIT 1) AND CommunicationLog.status = 'OPENED'

Constraints:
1. ONLY return the 'id' column from the Customer table. 
2. Use double quotes or backticks for tables like \`Order\` since it's a reserved word.
3. Draft TWO creative, personalized message variants (Variant A: Professional, Variant B: Casual/Emoji-heavy).
4. Use the exact string {{name}} where the customer's name should be dynamically inserted.
5. Set the channel based on the request, defaulting to 'whatsapp'.

User intent: "${intent}"
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    if (!response.text) {
      throw new Error("No text returned from Gemini");
    }

    const data = JSON.parse(response.text);
    
    // Execute SQL to get audience size and IDs
    const audienceRaw = await prisma.$queryRawUnsafe<{id: string}[]>(data.sqlQuery);
    const audienceIds = audienceRaw.map(row => row.id);

    // Fetch full details for the UI
    const audience = await prisma.customer.findMany({
      where: { id: { in: audienceIds } },
      select: { name: true, email: true },
      take: 10
    });

    return NextResponse.json({
      sqlQuery: data.sqlQuery,
      messageVariants: data.messageVariants,
      channel: data.channel,
      audienceSize: audienceIds.length,
      sampleCustomers: audience
    });
  } catch (error: any) {
    console.error("AI Intent Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
