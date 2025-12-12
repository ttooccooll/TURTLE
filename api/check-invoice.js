import fetch from 'node-fetch';
import crypto from 'crypto';

export default async function handler(req, res) {
  const { id: externalId } = req.query;
  if (!externalId) {
    return res.status(400).json({ error: 'Missing invoice ID' });
  }

  try {
    const query = `
      query Transactions($first: Int!) {
        me {
          defaultAccount {
            transactions(first: $first) {
              edges {
                node {
                  initiationVia {
                    ... on InitiationViaLn {
                      paymentRequest
                      paymentHash
                      externalId
                    }
                  }
                  settlementVia {
                    ... on SettlementViaLn {
                      preImage
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const variables = { first: 50 };

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
      console.error("Blink GraphQL errors:", data.errors);
      return res.status(500).json({ error: "Blink GraphQL errors", details: data.errors });
    }

    const transactions = data.data.me.defaultAccount.transactions.edges;

    // Find the transaction with matching externalId
    const tx = transactions.find(
      t => t.node.initiationVia?.externalId === externalId
    );

    if (!tx) {
      return res.status(404).json({ error: "Invoice not found in transactions" });
    }

    const { paymentHash } = tx.node.initiationVia;
    const preImage = tx.node.settlementVia?.preImage;

    // Not paid yet
    if (!preImage) {
      return res.status(200).json({ paid: false, paymentRequest: tx.node.initiationVia.paymentRequest });
    }

    // Verify preImage matches paymentHash
    const hash = crypto.createHash('sha256').update(Buffer.from(preImage, 'hex')).digest('hex');
    const paid = hash === paymentHash;

    return res.status(200).json({ paid, paymentRequest: tx.node.initiationVia.paymentRequest });

  } catch (err) {
    console.error("Server exception:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}