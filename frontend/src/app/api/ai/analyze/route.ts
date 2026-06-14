import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: Request) {
  try {
    const { campaignName, stats, audienceSize, messageBody, channel } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }
    
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `
You are an expert Marketing Data Analyst AI.
I have just run a marketing campaign and I need your analysis on the performance.

Campaign Context:
- Audience Size: ${audienceSize} targeted users
- Channel: ${channel}
- Message Sent: "${messageBody}"

Results (Real-time Funnel):
- Delivered: ${stats.DELIVERED || 0}
- Opened: ${stats.OPENED || 0}
- Clicked: ${stats.CLICKED || 0}
- Failed/Bounced: ${stats.FAILED || 0}

Your task:
1. Provide a brief, insightful, 2-3 sentence analysis of these metrics. For example, if open rates are high but click rates are low, suggest why.
2. Provide a single, actionable recommended prompt that the marketer can click to run a follow-up campaign based on these results. Keep the prompt short.

Format the output strictly as JSON:
{
  "analysis": "your 2-3 sentence insight here",
  "recommendedFollowUpPrompt": "Send a 20% discount reminder to users who opened but did not click"
}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    if (!response.text) {
      throw new Error("No text returned from Gemini");
    }

    const data = JSON.parse(response.text);
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
