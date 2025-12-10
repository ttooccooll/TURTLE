import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { id } = req.query; // id should be the paymentRequest string

  if (!id) return res.status(400).json({ error: 'Missing invoice ID' });

  try {
    const query = `
      query LnInvoicePaymentStatus($input: LnInvoicePaymentStatusInput!) {
        lnInvoicePaymentStatus(input: $input) {
          paymentRequest
          status
        }
      }
    `;

    const variables = {
      input: { paymentRequest: id }
    };

    const resp = await fetch(process.env.BLINK_SERVER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.BLINK_API_KEY,
      },
      body: JSON.stringify({ query, variables }),
    });

    const data = await resp.json();

    if (data.errors) {
      return res.status(500).json({ error: 'Blink GraphQL errors', details: data.errors });
    }

    const invoice = data.data.lnInvoicePaymentStatus;
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const paid = invoice.status === 'SETTLED';
    res.status(200).json({ paid, paymentRequest: invoice.paymentRequest });

  } catch (err) {
    console.error('Server exception:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
}
