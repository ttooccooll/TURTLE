import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amountSats, memo } = JSON.parse(req.body);

    const BLINK_API_KEY = process.env.BLINK_API_KEY;
    const WALLET_ID = process.env.BLINK_WALLET_ID;

    const query = `
      mutation CreateInvoice($walletId: ID!, $amount: Long!, $memo: String!) {
        invoiceCreate(input: {walletId: $walletId, amount: $amount, memo: $memo}) {
          invoice {
            paymentRequest
          }
        }
      }
    `;

    const variables = {
      walletId: WALLET_ID,
      amount: amountSats,
      memo: memo || 'Turtle Game Payment'
    };

    const response = await fetch('https://api.blink.sv/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': BLINK_API_KEY
      },
      body: JSON.stringify({ query, variables })
    });

    const text = await response.text(); // <-- debug
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Blink API did not return JSON:', text);
      return res.status(500).json({ error: 'Blink API returned invalid JSON', text });
    }

    const paymentRequest = data?.data?.invoiceCreate?.invoice?.paymentRequest;
    if (!paymentRequest) {
      console.error('Blink API error:', data);
      return res.status(500).json({ error: 'Failed to create invoice', data });
    }

    res.status(200).json({ paymentRequest });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
}
