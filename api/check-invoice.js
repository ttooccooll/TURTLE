import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const invoiceId = req.query.id;
    if (!invoiceId) {
      return res.status(400).json({ error: "Missing invoice ID" });
    }

    // Validate environment variables
    if (!process.env.BLINK_SERVER || !process.env.BLINK_API_KEY) {
      console.error("Missing BLINK_SERVER or BLINK_API_KEY");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const query = `
      query PaymentsWithProof($first: Int!) {
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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": process.env.BLINK_API_KEY,
      },
      body: JSON.stringify({ query, variables }),
    });

    const data = await resp.json();

    if (data.errors) {
      console.error("Blink GraphQL errors:", data.errors);
      return res.status(500).json({ error: "Blink API error", details: data.errors });
    }

    // Safe access to transactions
    const edges = data.data?.me?.defaultAccount?.transactions?.edges || [];
    if (!edges.length) {
      console.warn("No transactions found");
      return res.status(404).json({ error: "No transactions found" });
    }

    const tx = edges.find(
      (t) => t.node.initiationVia?.externalId === invoiceId
    );

    if (!tx) {
      console.warn("Invoice not found in transaction history:", invoiceId);
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Dynamic crypto import for Vercel
    const crypto = await import("crypto");

    const paymentHash = tx.node.initiationVia?.paymentHash;
    const preImage = tx.node.settlementVia?.preImage;

    if (!preImage) {
      return res.status(200).json({ paid: false, paymentRequest: tx.node.initiationVia.paymentRequest });
    }

    const hash = crypto.createHash("sha256").update(Buffer.from(preImage, "hex")).digest("hex");
    const paid = hash === paymentHash;

    return res.status(200).json({ paid, paymentRequest: tx.node.initiationVia.paymentRequest });

  } catch (err) {
    console.error("Server exception:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}