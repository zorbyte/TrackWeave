import ArweaveNode from "arweave/node";
import ArweaveWeb from "arweave/web";
import { or, equals } from "arql-ops";

export type Arweave = ArweaveNode | ArweaveWeb;

export function invertObj(obj: Object) {
  return Object.entries(obj).reduce((res, entry) => {
    const [key, value] = entry;
    res[value] = key;
    return res;
  }, {} as Record<any, any>);
}

export function genTargetWalletOps(
  walletAddr: string,
  walletDirs: ("to" | "from")[],
) {
  const walletOps = walletDirs.map((dir) => equals(dir, walletAddr));
  return walletDirs.length > 1 ? [or(...walletOps)] : walletOps;
}
