const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Helper to simulate delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to send webhook
const sendWebhook = async (url, payload) => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log(`[Webhook Sent] ${payload.status} to ${url} - Status: ${response.status}`);
  } catch (error) {
    console.error(`[Webhook Failed] Error sending to ${url}:`, error.message);
  }
};

app.post('/api/send', (req, res) => {
  const { campaignId, communicationId, recipientId, channel, callbackUrl } = req.body;

  if (!communicationId || !callbackUrl) {
    return res.status(400).json({ error: 'Missing communicationId or callbackUrl' });
  }

  // Acknowledge receipt immediately
  res.status(202).json({ message: 'Message accepted for delivery', communicationId });

  console.log(`[Accepted] Message ${communicationId} for campaign ${campaignId} over ${channel}`);

  // Start the simulation lifecycle asynchronously
  simulateDeliveryLifecycle(communicationId, callbackUrl);
});

async function simulateDeliveryLifecycle(communicationId, callbackUrl) {
  // 1. Simulate network transit time (1-3 seconds)
  await delay(Math.random() * 2000 + 1000);

  // 30% chance of delivery failure (e.g., bounced, invalid number) - increased for testing
  const isFailed = Math.random() < 0.30;
  if (isFailed) {
    await sendWebhook(callbackUrl, {
      communicationId,
      status: 'FAILED',
      timestamp: new Date().toISOString()
    });
    return; // Lifecycle ends here
  }

  // If not failed, it's delivered
  await sendWebhook(callbackUrl, {
    communicationId,
    status: 'DELIVERED',
    timestamp: new Date().toISOString()
  });

  // 2. Simulate time before user sees the notification (2-5 seconds)
  await delay(Math.random() * 3000 + 2000);

  // 60% chance they open it
  const isOpened = Math.random() < 0.60;
  if (!isOpened) {
    return; // Lifecycle ends here (delivered but never opened)
  }

  await sendWebhook(callbackUrl, {
    communicationId,
    status: 'OPENED',
    timestamp: new Date().toISOString()
  });

  // 3. Simulate time reading the message before clicking (2-4 seconds)
  await delay(Math.random() * 2000 + 2000);

  // 40% chance they click the link inside
  const isClicked = Math.random() < 0.40;
  if (!isClicked) {
    return; // Lifecycle ends here (opened but not clicked)
  }

  await sendWebhook(callbackUrl, {
    communicationId,
    status: 'CLICKED',
    timestamp: new Date().toISOString()
  });
}

app.listen(PORT, () => {
  console.log(`Channel Stub Service running on port ${PORT}`);
});
