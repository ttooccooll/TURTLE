import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { amount, memo } = req.body;
  if (!amount) return res.status(400).json({ error: "Missing amount" });

  try {
    const query = `
      mutation CreateInvoice($walletId: ID!, $amount: Sat!, $memo: String!) {
        createInvoice(walletId: $walletId, amount: $amount, memo: $memo) {
          paymentRequest
          paymentHash
        }
      }
    `;

    const variables = {
      walletId: process.env.BLINK_WALLET_ID,
      amount,
      memo: memo || "Turtle Game Payment"
    };

    const response = await fetch(process.env.BLINK_SERVER, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": process.env.BLINK_API_KEY
      },
      body: JSON.stringify({ query, variables })
    });

    const json = await response.json();

    if (json.errors) {
      return res.status(500).json({ error: "Blink GraphQL error", details: json.errors });
    }

    const invoice = json.data.createInvoice;
    if (!invoice || !invoice.paymentRequest || !invoice.paymentHash) {
      return res.status(500).json({ error: "Invalid invoice response from Blink" });
    }

    return res.status(200).json({
      paymentRequest: invoice.paymentRequest,
      paymentHash: invoice.paymentHash
    });

  } catch (err) {
    console.error("Invoice creation failed:", err);
    res.status(500).json({ error: "Server error", details: err.toString() });
  }
}
