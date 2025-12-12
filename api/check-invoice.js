import fetch from "node-fetch";

export default async function handler(req, res) {
  const { paymentHash } = req.query;
  if (!paymentHash) {
    return res.status(400).json({ error: "Missing paymentHash" });
  }

  try {
    const query = `
      query GetInvoice($paymentHash: PaymentHash!) {
        invoice(paymentHash: $paymentHash) {
          paymentHash
          paymentRequest
          status
          satoshis
        }
      }
    `;

    const variables = { paymentHash };

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

    const inv = json.data.invoice;
    if (!inv) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    return res.status(200).json({
      paid: inv.status === "PAID",
      satoshi: inv.satoshis
    });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error", details: err.toString() });
  }
}
