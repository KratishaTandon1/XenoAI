# Xeno AI Marketing CRM

An intelligent, autonomous Marketing CRM built for the Xeno Engineering Internship Assignment. This system moves beyond traditional CRMs by deeply integrating AI to handle segmentation, messaging, and funnel analysis autonomously.

## Core Features & Testing Guide

<details>
<summary><b>✨ AI-Powered Audience Segmentation & Messaging</b></summary>
<br>
Instead of manually building complex filters, type natural language (e.g., "target users who spent over $50"). The system feeds your intent to Google's Gemini Flash model, which intelligently writes and executes the correct SQL query against our SQLite database to find the exact audience. Simultaneously, the AI generates two highly personalized message variants (Professional vs. Casual) based on your intent.

**How to test:**
1. In the chat interface, type: `Send a 20% discount on WhatsApp to users who have spent over $50`
2. The AI will instantly query the database and present you with the exact audience size and message variants to choose from.
</details>

<details>
<summary><b>📡 Live Simulation & Real-time Flowchart</b></summary>
<br>
To demonstrate the system in action without relying on third-party APIs, this project includes a deterministic mock pub/sub `channel-service`. When a campaign launches, messages are queued and the external service fires asynchronous webhooks back to the CRM to simulate realistic network latency and user behavior progression (DELIVERED ➔ OPENED ➔ CLICKED).

**How to test:**
1. Execute any campaign from the AI proposal.
2. Scroll down to the **Simulation Architecture** section.
3. Watch the nodes fill up in real-time as webhooks arrive in the live feed below it. You will see users progress through the funnel probabilistically.
</details>

<details>
<summary><b>🔄 Smart Channel Fallbacks</b></summary>
<br>
Messages inevitably bounce or fail to deliver in the real world. If a message hits the `FAILED` state on a primary channel (like Email or WhatsApp), the CRM's webhook listener autonomously catches the failure and immediately re-dispatches the exact same message over a fallback channel (SMS), ensuring maximum deliverability without any human intervention.

**How to test:**
1. The mock channel service is configured with a 30% failure rate for testing purposes.
2. Launch a campaign targeting at least 5-10 users on **Email** or **WhatsApp**.
3. Watch the flowchart. When a user hits the `FAILED` node, you will instantly see a `[FALLBACK]` webhook fired in the feed, and an orange "Smart Fallback Loop" indicator will appear in the UI.
</details>

<details>
<summary><b>🧠 Contextual Follow-ups & AI Analyst</b></summary>
<br>
Once a campaign concludes, the CRM can feed the final performance metrics (open rates, click rates, bounces) back into the AI to generate a custom analytical report. Even better, the AI retains context of past campaigns, allowing you to run hyper-targeted follow-ups based on a user's exact engagement in the previous funnel.

**How to test:**
1. After a campaign finishes running, click the **✨ Generate AI Insights** button.
2. Gemini will read your funnel stats and recommend a next action.
3. To test the contextual memory, type: `Send a reminder to users who opened but did not click`. 
4. The AI will automatically join the `CommunicationLog` table, filter by the previous campaign ID, and perfectly target the users who dropped off at that exact stage!
</details>

---

## Technical Architecture
- **Frontend / API**: Next.js 15 (App Router), React, TailwindCSS, Framer Motion
- **Database**: Prisma ORM, local SQLite DB
- **AI Integration**: `@google/genai` SDK (Gemini 2.5 Flash)
- **External Services**: Node.js `channel-service` running concurrently to simulate a third-party webhook provider.

## Local Setup

1. **Clone & Install**
   Install dependencies in both the main directory and the mock service:
   ```bash
   cd frontend
   npm install
   cd ../channel-service
   npm install
   ```

2. **Database Setup**
   Seed the SQLite database with mock users and orders:
   ```bash
   cd frontend
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```

3. **Environment Variables**
   Create a `.env` file in the `frontend` directory:
   ```
   GEMINI_API_KEY=your_google_gemini_key_here
   ```

4. **Run the Services**
   You need to run both the frontend and the mock channel service simultaneously:
   
   *Terminal 1 (Mock Webhook Provider):*
   ```bash
   cd channel-service
   node server.js
   ```

   *Terminal 2 (CRM):*
   ```bash
   cd frontend
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) and say hello to your new AI Marketing Agent!
