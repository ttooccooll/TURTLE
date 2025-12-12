import fetch from 'node-fetch';

export default async function handler(req, res) {
  const invoiceId = req.query.id;
  if (!invoiceId) return res.status(400).json({ error: 'Missing invoice ID' });

  try {
    const query = `
      query LnInvoice($id: ID!) {
        lnInvoice(id: $id) {
          id
          memo
          amount
          settled
        }
      }
    `;

    const variables = { id: invoiceId };

    const response = await fetch(process.env.BLINK_SERVER, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": process.env.BLINK_API_KEY
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Blink API returned non-JSON:', text);
      return res.status(response.status).json({ error: 'Blink API error', details: text });
    }

    const json = await response.json();

    if (json.errors) {
      console.error("Blink GraphQL error:", json.errors);
      return res.status(500).json({ error: "Blink GraphQL error", details: json.errors });
    }

    const invoice = json.data.lnInvoice;

    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    return res.json({
      paid: invoice.settled === true,
      satoshi: invoice.amount,
      memo: invoice.memo
    });

  } catch (err) {
    console.error("Server exception:", err);
    return res.status(500).json({ error: "Server error", details: err.toString() });
  }
}
