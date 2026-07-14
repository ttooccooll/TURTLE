import { NWCClient } from "@getalby/sdk/nwc";

// The client picks the amount (100 to unlock a game, 10000 for the tip button),
// so bound what we are willing to mint rather than trusting it outright.
export const MIN_SATS = 1;
export const MAX_SATS = 1_000_000;

export const INVOICE_EXPIRY_SECONDS = 600;

// NIP-47 speaks millisats everywhere.
export const satsToMsats = (sats) => sats * 1000;

export async function withNwc(fn) {
  const nostrWalletConnectUrl = process.env.NWC_URL;
  if (!nostrWalletConnectUrl) {
    throw new Error("NWC_URL is not set");
  }

  const client = new NWCClient({ nostrWalletConnectUrl });
  try {
    return await fn(client);
  } finally {
    // The relay websocket keeps the event loop alive. Without this the
    // serverless invocation hangs until it times out.
    client.close();
  }
}
