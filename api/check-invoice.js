import fetch from "node-fetch";

export default async function handler(req, res) {
  const paymentHash = req.query.paymentHash;

  // Log incoming request
  console.log("Received check-invoice request, paymentHash:", paymentHash);

  if (!paymentHash) {
    console.error("Missing paymentHash in request");
    return res.status(400).json({ error: "Missing paymentHash" });
  }

  if (!process.env.BLINK_WALLET_ID || !process.env.BLINK_API_KEY || !process.env.BLINK_SERVER) {
    console.error("Missing Blink environment variables");
    return res.status(500).json({ error: "Server not configured properly" });
  }

  try {
    const query = `
      query CheckInvoiceStatus($walletId: ID!, $paymentHash: String!) {
        wallet(id: $walletId) {
          invoiceByPaymentHash(paymentHash: $paymentHash) {
            paymentStatus
            satoshis
          }
        }
      }
    `;

    const variables = {
      walletId: process.env.BLINK_WALLET_ID,
      paymentHash
    };

    console.log("Sending GraphQL request to Blink:", variables);

    const response = await fetch(process.env.BLINK_SERVER, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": process.env.BLINK_API_KEY
      },
      body: JSON.stringify({ query, variables })
    });

    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      console.error("Blink returned non-JSON response:", text);
      return res.status(500).json({ error: "Blink returned non-JSON", details: text });
    }

    console.log("Blink response:", json);

    if (!response.ok) {
      console.error("Blink API HTTP error:", response.status, text);
      return res.status(response.status).json({ error: "Blink API error", details: text });
    }

    if (json.errors) {
      console.error("GraphQL errors from Blink:", json.errors);
      return res.status(500).json({ error: "GraphQL error", details: json.errors });
    }

    const inv = json.data.wallet.invoiceByPaymentHash;
    if (!inv) {
      console.error("Invoice not found for hash:", paymentHash);
      return res.status(404).json({ error: "Invoice not found" });
    }

    return res.status(200).json({
      paid: inv.paymentStatus === "PAID",
      satoshi: inv.satoshis
    });

  } catch (err) {
    console.error("Server error in check-invoice:", err);
    return res.status(500).json({ error: "Server error", details: err.toString() });
  }
}
