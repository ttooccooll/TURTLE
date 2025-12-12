import fetch from "node-fetch";

export default async function handler(req, res) {
  const paymentHash = req.query.paymentHash;

  if (!paymentHash) return res.status(400).json({ error: "Missing paymentHash" });

  try {
    const query = `
      query CheckInvoiceStatus($paymentHash: String!) {
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

    const json = await response.json();

    if (!response.ok || json.errors) {
      console.error("Blink API error:", json.errors || json);
      return res.status(response.status || 500).json({ error: "Blink API error", details: json });
    }

    const inv = json.data.invoiceByPaymentHash;
    if (!inv) return res.status(404).json({ error: "Invoice not found" });

    return res.status(200).json({
      paid: inv.paymentStatus === "PAID",
      satoshi: inv.satoshis
    });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error", details: err.toString() });
  }
}
