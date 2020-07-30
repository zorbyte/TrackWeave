import Arweave from "arweave/node";
import { CreateTransactionInterface } from "arweave/node/common";
import { JWKPublicInterface } from "arweave/node/lib/wallet";
import { nanoid } from "nanoid/async";

export async function createRoot(client: Arweave, jwk: JWKPublicInterface) {
  return dispatchTx(client, {
    jwk,
    tags: {
      "RDT-Type": "Root",
      "RDT-Version": "0.0.5",
      "Root-Id": await nanoid(),
      "Created-At": Date.now().toString(),
      "Edge-Head": await nanoid(),
    },
  });
}

interface DispatchTxOpts {
  data?: string;
  refreshAnchor?: boolean;
  amount?: string | number;
  targetWalletAddr?: string;
  tags?: Record<string, string>;
  jwk: JWKPublicInterface;
}

async function dispatchTx(client: Arweave, opts: DispatchTxOpts) {
  const txOpts: Partial<CreateTransactionInterface> = {
    data: opts.data,
    target: opts.targetWalletAddr,
    last_tx: await getAnchor(client, opts.refreshAnchor ?? true),
  };

  if (opts.targetWalletAddr) txOpts.target = opts.targetWalletAddr;

  if (opts.amount) {
    txOpts.quantity = client.ar.arToWinston(
      typeof opts.amount === "string" ? opts.amount : `${opts.amount}`
    );
  }

  const tx = await client.createTransaction(txOpts, opts.jwk);

  if (opts.tags) {
    for (const [key, value] of Object.entries(opts.tags)) {
      tx.addTag(key, value);
    }
  }

  await client.transactions.sign(tx, opts.jwk);

  const res = await client.transactions.post(tx);

  if (res.status >= 300) {
    const err = new Error("Transaction failed");
    (err as Error & {
      res: { status: number; statusText: string; data: any };
    }).res = res;

    throw err;
  }

  return tx;
}

let cachedTxAnchor: string | undefined;
async function getAnchor(client: Arweave, refresh = false) {
  if (typeof cachedTxAnchor === "undefined" || refresh) {
    cachedTxAnchor = (await client.api.get("tx_anchor")).data || "";
  }

  return cachedTxAnchor as string;
}
