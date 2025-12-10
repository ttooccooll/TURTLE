import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) return res.status(400).json({ error: 'Missing invoice ID' });

  try {
    const resp = await fetch(process.env.BLINK_SERVER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.BLINK_API_KEY,
      },
      body: JSON.stringify({
        query: `
          query LnInvoiceByExternalId($externalId: String!) {
            lnInvoiceByExternalId(externalId: $externalId) {
              paymentRequest
              status
            }
          }
        `,
        variables: { externalId: id },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(500).json({ error: 'Blink server error', details: text });
    }

    const data = await resp.json();

    if (data.errors) {
      return res.status(500).json({ error: 'Blink GraphQL errors', details: data.errors });
    }

    const invoice = data.data.lnInvoiceByExternalId;

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const paid = invoice.status === 'SETTLED';

    res.status(200).json({ paid, paymentRequest: invoice.paymentRequest });
  } catch (err) {
    console.error('Server exception:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
}
