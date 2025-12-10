import fetch from 'node-fetch';
import crypto from 'crypto';

export const invoiceMap = {};

export default async function handler(req, res) {
  if (req.method !== 'POST') 
    return res.status(405).json({ error: 'Method not allowed' });

  const { amount, memo, useWallet } = req.body;
  if (!amount || isNaN(amount)) 
    return res.status(400).json({ error: 'Amount must be a number' });

  try {
    const BLINK_SERVER = process.env.BLINK_SERVER;
    const BLINK_API_KEY = process.env.BLINK_API_KEY;
    const BLINK_WALLET_ID = process.env.BLINK_WALLET_ID;

    const query = `
      mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {
        lnInvoiceCreate(input: $input) {
          invoice { paymentRequest }
          errors { message }
        }
      }
    `;

    const variables = {
      input: {
        amount: parseInt(amount),
        memo: memo || "Turtle Game Payment",
        ...(useWallet ? { walletId: BLINK_WALLET_ID, externalId: generateUUID() } : {})
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

    let data;
    const contentType = resp.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      data = await resp.json();
    } else {
      const text = await resp.text();
      console.error('Non-JSON server response:', text);
      return res.status(500).json({ error: 'Server returned non-JSON response', details: text });
    }

    if (data.errors || (data.data.lnInvoiceCreate.errors.length)) {
      console.error('GraphQL errors:', data.errors || data.data.lnInvoiceCreate.errors);
      return res.status(500).json({ 
        error: 'Failed to create invoice', 
        details: data.errors || data.data.lnInvoiceCreate.errors 
      });
    }

    const invoiceId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    invoiceMap[invoiceId] = data.data.lnInvoiceCreate.invoice.paymentRequest;

    return res.status(200).json({ 
      paymentRequest: data.data.lnInvoiceCreate.invoice.paymentRequest,
      id: invoiceId
    });

  } catch (err) {
    console.error('Server exception:', err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}
