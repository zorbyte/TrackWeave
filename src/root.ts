import { TagMap, fetchTags, mapTagsToValues } from "./tags";
import { Arweave } from "./utils";
import { and, equals } from "arql-ops";
import { NodeType } from ".";

export interface RDTRootNode<T = NodeType.Root> {
  txId?: string;

  type:T;
  majorVersion: number;

  root: string;
  createdAt: Date;

  tail?: string;
  head: string;

  otherTags?: Record<string, string>;
}

export type AbstractRTDRootNode = string | RDTRootNode;

export const ROOT_NODE_TAG_MAP: TagMap<RDTRootNode> = {
  type: "RDT-Type",
  majorVersion: "RDT-Major-Version",

  root: "Root-Id",
  createdAt: "Created-At",

  tail: "Tail-Node",
  head: "Head-Node",
};

interface FindRootNodeOpts {
  // Either the id of the root node, or a node with the root node ID.
  abstractNode?: AbstractRTDRootNode;
  walletAddr?: string;
}

export async function findRootNode(
  client: Arweave,
  {
    abstractNode,
    walletAddr,
  }: FindRootNodeOpts,
) {
  if (!abstractNode && !walletAddr) {
    throw new TypeError(
      "Insufficient arguments: abstractNode and/or walletAddr must be provided",
    );
  }

  const exprs = [equals("RDT-Type", NodeType.Root)];
  if (walletAddr) exprs.push(equals("from", walletAddr));
  if (abstractNode) {
    exprs.push(
      equals(
        "Root-Id",
        typeof abstractNode === "string" ? abstractNode : abstractNode!.root,
      ),
    );
  }

  const query = and(...exprs);

  const txIds = await client.arql(query);

  // Get oldest one, as others are not the original.
  const txId = txIds[txIds.length - 1];

  const tags = await fetchTags(client, txId);
  const mapped = mapTagsToValues(ROOT_NODE_TAG_MAP, tags);
  mapped.txId = txId
  mapped.createdAt = new Date(mapped.createdAt);

  return mapped;
}
