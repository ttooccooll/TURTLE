import fetch from 'node-fetch';
import crypto from 'crypto';

export const invoiceMap = {};

export default async function handler(req, res) {
  if (req.method !== 'POST') 
    return res.status(405).json({ error: 'Method not allowed' });

  const { amount, memo } = req.body;
  if (!amount || isNaN(amount)) 
    return res.status(400).json({ error: 'Amount must be a number' });

  try {
    const BLINK_SERVER = process.env.BLINK_SERVER;
    const BLINK_API_KEY = process.env.BLINK_API_KEY;
    const BLINK_WALLET_ID = process.env.BLINK_WALLET_ID;

    const query = `
      mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {
        lnInvoiceCreate(input: $input) {
          invoice { id paymentRequest }
          errors { message }
        }
      }
    `;

    const variables = {
      input: {
        amount: parseInt(amount),
        walletId: BLINK_WALLET_ID,
        memo: memo || "Turtle Game Payment",
        externalId: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        expiresIn: 10
      }
    };

    const resp = await fetch(BLINK_SERVER, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'X-API-KEY': BLINK_API_KEY 
      },
      body: JSON.stringify({ query, variables })
    });

    const data = await resp.json();

    if (data.errors || data.data.lnInvoiceCreate.errors.length) {
      return res.status(500).json({
        error: "Failed to create invoice",
        details: data.errors || data.data.lnInvoiceCreate.errors
      });
    }

    const blinkInvoiceId = data.data.lnInvoiceCreate.invoice.id;

    invoiceMap[blinkInvoiceId] = data.data.lnInvoiceCreate.invoice.paymentRequest;

    return res.status(200).json({
      paymentRequest: data.data.lnInvoiceCreate.invoice.paymentRequest,
      id: blinkInvoiceId
    });

  } catch (err) {
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}
