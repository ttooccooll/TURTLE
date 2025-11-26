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
      mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {
        lnInvoiceCreate(input: $input) {
          invoice {
            paymentRequest
            paymentHash
            paymentSecret
            satoshis
          }
          errors {
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        walletId: BLINK_WALLET_ID,
        amount: amount.toString(),
        memo: memo || "Turtle Game Payment"
      }
    };

    const response = await fetch(BLINK_SERVER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': BLINK_API_KEY
      },
      body: JSON.stringify({ query, variables })
    });

    const json = await response.json();

    if (json.errors && json.errors.length > 0) {
      console.error("Blink API returned GraphQL errors:", json.errors);
      return res.status(500).json({ error: 'Failed to create invoice', details: json.errors });
    }

    if (json.data.lnInvoiceCreate.errors && json.data.lnInvoiceCreate.errors.length > 0) {
      console.error("Blink API returned invoice errors:", json.data.lnInvoiceCreate.errors);
      return res.status(500).json({ error: 'Failed to create invoice', details: json.data.lnInvoiceCreate.errors });
    }

    const paymentRequest = json.data.lnInvoiceCreate.invoice.paymentRequest;

    return res.status(200).json({ paymentRequest });

  } catch (error) {
    console.error("Server error generating Blink invoice:", error);
    return res.status(500).json({ error: 'Server error generating invoice' });
  }
}
