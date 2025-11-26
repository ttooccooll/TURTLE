import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { amount, memo } = req.body;

  const query = `
    mutation invoiceCreate($input: InvoiceCreateInput!) {
      invoiceCreate(input: $input) {
        invoice {
          paymentRequest
        }
      }
    }
  `;

  const variables = {
    input: {
      walletId: 'c5a11a30-7abc-48d7-a71a-008fa2ec4532',
      amount: parseInt(amount),
      memo: memo || 'Turtle Game Payment'
    }
  };

  try {
    const response = await fetch('https://api.blink.sv/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.BLINK_API_KEY,
      },
      body: JSON.stringify({ query, variables })
    });

    const data = await response.json();
    if (!data.data?.invoiceCreate?.invoice?.paymentRequest) {
      console.error('Blink API error:', data);
      return res.status(500).json({ error: 'Failed to create invoice' });
    }

    res.status(200).json({ paymentRequest: data.data.invoiceCreate.invoice.paymentRequest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
