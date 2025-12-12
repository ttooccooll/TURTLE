import fetch from "node-fetch";

export default async function handler(req, res) {
  const paymentHash = req.query.paymentHash;
  if (!paymentHash) {
    return res.status(400).json({ error: "Missing paymentHash" });
  }

  try {
    const query = `
      query CheckInvoiceStatus($paymentHash: PaymentHash!) {
        invoiceByPaymentHash(paymentHash: $paymentHash) {
          paymentStatus
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

    if (!response.ok) {
      const text = await response.text();
      console.error("Blink API HTTP error:", response.status, text);
      return res.status(response.status).json({ error: "Blink API error", details: text });
    }

    const json = await response.json();
    if (json.errors) {
      console.error("Blink GraphQL error:", json.errors);
      return res.status(500).json({ error: "Blink GraphQL error", details: json.errors });
    }

    const inv = json.data.invoiceByPaymentHash;
    if (!inv) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    return res.status(200).json({
      paid: inv.paymentStatus === "PAID",
      satoshi: inv.satoshis
    });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error", details: err.toString() });
  }
}
