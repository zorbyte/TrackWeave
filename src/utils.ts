import ArweaveNode from "arweave/node";
import ArweaveWeb from "arweave/web";

export type Arweave = ArweaveNode | ArweaveWeb;

export function invertObj(obj: Object) {
  return Object.entries(obj).reduce((res, entry) => {
    const [key, value] = entry;
    res[value] = key;
    return res;
  }, {} as Record<any, any>);
}
