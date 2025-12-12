import fetch from 'node-fetch';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const { amount, memo } = req.body;
  if (!amount || isNaN(amount))
    return res.status(400).json({ error: 'Amount must be a number' });

  try {
    const invoiceId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);

    const query = `
      mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {
        lnInvoiceCreate(input: $input) {
          invoice {
            paymentRequest
            externalId
          }
          errors { message }
        }
      }
    `;

    const variables = {
      input: {
        amount: parseInt(amount),
        walletId: process.env.BLINK_WALLET_ID,
        memo: memo || "Turtle Game Payment",
        externalId: invoiceId
      }
    };

    const resp = await fetch(process.env.BLINK_SERVER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.BLINK_API_KEY
      },
      body: JSON.stringify({ query, variables })
    });

    const data = await resp.json();

    if (data.errors || data.data.lnInvoiceCreate.errors.length) {
      return res.status(500).json({
        error: 'Failed to create invoice',
        details: data.errors || data.data.lnInvoiceCreate.errors
      });
    }

    const invoice = data.data.lnInvoiceCreate.invoice;

    return res.status(200).json({
      paymentRequest: invoice.paymentRequest,
      externalId: invoiceId
    });

  } catch (err) {
    console.error('Server exception:', err);
    res.status(500).json({ error: err.message });
  }
}
