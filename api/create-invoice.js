import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Only POST requests allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, memo } = req.body;

  // Validate amount
  if (!amount || isNaN(amount)) {
    return res.status(400).json({ error: 'Amount is required and must be a number' });
  }

  try {
    // Load environment variables
    const BLINK_SERVER = process.env.BLINK_SERVER;
    const BLINK_API_KEY = process.env.BLINK_API_KEY;
    const BLINK_WALLET_ID = process.env.BLINK_WALLET_ID;

    if (!BLINK_SERVER || !BLINK_API_KEY || !BLINK_WALLET_ID) {
      return res.status(500).json({ error: 'Blink server or API key not set' });
    }

    // GraphQL query to create an invoice
    const query = `
      mutation CreateInvoice($walletId: ID!, $amount: Int!, $memo: String) {
        createInvoice(input: {walletId: $walletId, amount: $amount, memo: $memo}) {
          invoice { paymentRequest id }
        }
      }
    `;

    const variables = {
      walletId: BLINK_WALLET_ID,
      amount: parseInt(amount),
      memo: memo || 'Turtle Game Payment',
    };

    // Send request to Blink
    const response = await fetch(BLINK_SERVER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': BLINK_API_KEY,
      },
      body: JSON.stringify({ query, variables }),
    });

    const text = await response.text();
    console.log('Blink raw response:', text); // Log raw response for debugging

    // Try to parse JSON
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({ error: 'Blink did not return valid JSON', details: text });
    }

    // Check for GraphQL errors
    if (json.errors) {
      console.error('Blink API returned errors:', json.errors);
      return res.status(500).json({ error: 'Blink API returned errors', details: json.errors });
    }

    // Make sure invoice exists
    if (!json.data?.createInvoice?.invoice?.paymentRequest) {
      return res.status(500).json({ error: 'Blink API did not return a payment request', details: json });
    }

    // Success
    return res.status(200).json({ paymentRequest: json.data.createInvoice.invoice.paymentRequest });

  } catch (err) {
    console.error('Server error generating Blink invoice:', err);
    return res.status(500).json({ error: 'Server error generating invoice', details: err.message });
  }
}
