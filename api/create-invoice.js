import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, memo } = req.body;

    if (!amount || typeof amount !== 'number') {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const BLINK_API_KEY = process.env.BLINK_API_KEY;
    const WALLET_ID = process.env.BLINK_WALLET_ID;
    const BLINK_URL = 'https://api.blink.sv/graphql';

    const query = `
      mutation CreateInvoice($walletId: ID!, $amount: Int!, $memo: String!) {
        createInvoice(walletId: $walletId, input: { amount: $amount, memo: $memo }) {
          paymentRequest
          id
        }
      }
    `;

    const variables = {
      walletId: WALLET_ID,
      amount,
      memo: memo || 'Turtle Game Payment'
    };

    const response = await fetch(BLINK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BLINK_API_KEY}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    const data = await response.json();

    if (data.errors) {
      console.error('Blink API returned errors:', data.errors);
      return res.status(500).json({ error: 'Failed to create invoice', details: data.errors });
    }

    const paymentRequest = data.data.createInvoice.paymentRequest;

    res.status(200).json({ paymentRequest });
  } catch (err) {
    console.error('Error in /api/create-invoice:', err);
    res.status(500).json({ error: 'Server error' });
  }
}