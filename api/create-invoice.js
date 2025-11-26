import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, memo } = req.body;

  if (!amount || isNaN(amount)) {
    return res.status(400).json({ error: 'Amount is required and must be a number' });
  }

  // Validate environment variables
  const { BLINK_SERVER, BLINK_API_KEY, BLINK_WALLET_ID } = process.env;
  if (!BLINK_SERVER || !BLINK_API_KEY || !BLINK_WALLET_ID) {
    console.error("Missing Blink environment variables");
    return res.status(500).json({ error: "Server misconfiguration: missing Blink credentials" });
  }

  const query = `
    mutation CreateInvoice($walletId: ID!, $amount: Int!, $memo: String) {
      createInvoice(input: { walletId: $walletId, amount: $amount, memo: $memo }) {
        invoice {
          paymentRequest
          id
        }
      }
    }
  `;

  const variables = {
    walletId: BLINK_WALLET_ID,
    amount: Number(amount),
    memo: memo || "Turtle Game Payment",
  };

  try {
    const response = await fetch(BLINK_SERVER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': BLINK_API_KEY,
      },
      body: JSON.stringify({ query, variables }),
    });

    // Read raw response first
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (parseError) {
      console.error("Blink API did not return valid JSON:", text);
      return res.status(500).json({
        error: "Blink API did not return valid JSON",
        rawResponse: text,
      });
    }

    if (json.errors) {
      console.error("Blink API returned errors:", json.errors);
      return res.status(500).json({ error: 'Failed to create invoice', details: json.errors });
    }

    const paymentRequest = json?.data?.createInvoice?.invoice?.paymentRequest;
    if (!paymentRequest) {
      console.error("Blink API response missing paymentRequest:", json);
      return res.status(500).json({ error: "Blink API response missing paymentRequest", details: json });
    }

    return res.status(200).json({ paymentRequest });
  } catch (error) {
    console.error("Server error generating Blink invoice:", error);
    return res.status(500).json({ error: 'Server error generating invoice', details: error.message });
  }
}