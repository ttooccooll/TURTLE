import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, memo } = req.body;

  if (!amount || isNaN(amount)) {
    return res.status(400).json({ error: 'Amount is required and must be a number' });
  }

  try {

    const BLINK_SERVER = process.env.BLINK_SERVER;
    const BLINK_API_KEY = process.env.BLINK_API_KEY;
    const BLINK_WALLET_ID = process.env.BLINK_WALLET_ID;

    const query = `
      mutation CreateInvoice($walletId: ID!, $amount: Int!, $memo: String) {
        createInvoice(input: {walletId: $walletId, amount: $amount, memo: $memo}) {
          invoice {
            paymentRequest
            id
          }
        }
      }
    `;

    const variables = {
      walletId: BLINK_WALLET_ID,
      amount: amount,
      memo: memo || "Turtle Game Payment",
    };

    const response = await fetch(BLINK_SERVER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': BLINK_API_KEY,
      },
      body: JSON.stringify({ query, variables }),
    });

    const json = await response.json();
    if (json.errors) {
      console.error("Blink API returned errors:", json.errors);
      return res.status(500).json({ error: 'Failed to create invoice', details: json.errors });
    }

    const paymentRequest = json.data.createInvoice.invoice.paymentRequest;
    return res.status(200).json({ paymentRequest });

  } catch (error) {
    console.error("Server error generating Blink invoice:", error);
    return res.status(500).json({ error: 'Server error generating invoice' });
  }
}
