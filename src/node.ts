import { RDTRootNode, ROOT_NODE_TAG_MAP, AbstractRDTRootNode } from "./root";
import { TagMap, fetchTags, mapTagsToValues } from "./tags";
import { RDTBranchNode, BRANCH_NODE_TAG_MAP } from "./branch";
import { Arweave } from "./utils";
import { NodeType } from ".";

import { ArqlOp, equals, and, or } from "arql-ops";

export interface RDTNode extends RDTRootNode<NodeType.Node> {
  depth: number;
  tail: string;
}

export const NODE_TAG_MAP: TagMap<RDTNode> = {
  ...ROOT_NODE_TAG_MAP,
  depth: "Branch-Depth",
};

interface GetNodeOpts<D extends number, F extends boolean> {
  root: AbstractRDTRootNode;

  // Find a node with their head or tail values set to this.
  tail?: string;
  head?: string;

  depth?: D;

  // Get the surrounding nodes if possible.
  // i.e. node(.., head: a) - node(tail: a, head: b) - node(tail: b, ...)
  //      All nodes will be collected.
  fetchGreedily?: F;
  walletAddr?: string;
}

export async function getNode(
  client: Arweave,
  opts: GetNodeOpts<0, false>,
): Promise<RDTNode>;
export async function getNode(
  client: Arweave,
  opts: GetNodeOpts<0, true>,
): Promise<RDTNode[]>;
export async function getNode(
  client: Arweave,
  opts: GetNodeOpts<number, false>,
): Promise<RDTBranchNode>;
export async function getNode(
  client: Arweave,
  opts: GetNodeOpts<number, true>,
): Promise<RDTBranchNode[]>;
export async function getNode<D extends number, F extends boolean>(
  client: Arweave,
  {
    root,
    tail,
    head,
    depth = 0 as D,
    fetchGreedily = false as F,
    walletAddr,
  }: GetNodeOpts<D, F>,
) {
  if (tail === head) throw new TypeError("Argument error: Tail ID is the same as Head ID")
  if (!tail && !head) {
    throw new TypeError("Insufficient arguments: tail or head must be defined");
  }

  const prev: ArqlOp[] = [];
  const curr: ArqlOp[] = [equals("Branch-Depth", depth.toString())];
  const next: ArqlOp[] = [];
  const query: ArqlOp[] = [
    equals("Root-Id", typeof root === "string" ? root : root.root),
  ];

  if (walletAddr) curr.push(equals("from", walletAddr));
  if (tail) {
    if (fetchGreedily) prev.push(equals("Head-Node", tail));
    curr.push(equals("Tail-Node", tail));
  }

  if (head) {
    if (fetchGreedily) next.push(equals("Tail-Node", head));
    curr.push(equals("Head-Node", head));
  }

  const combined: ArqlOp[] = [and(...curr)];

  if (prev.length) combined.push(and(...prev));
  if (next.length) combined.push(and(...next));
  query.push(or(...combined));

  let prevNode: RDTNode | RDTBranchNode;
  let lastWasBranch = false;
  let deadEnd = false;
  let branchTailNode: RDTNode | undefined;
  const txIds = await client.arql(query);
  let nodes = await Promise.all(
    txIds.flatMap(async (txId) => {
      if (deadEnd) return [];

      const tags = await fetchTags(client, txId);
      const isBranch = !!tags["Branch-Tail-Node"];
      const node = mapTagsToValues(
        isBranch ? BRANCH_NODE_TAG_MAP : NODE_TAG_MAP,
        tags,
      );

      // Detect circular that doesn't use branches.
      if (
        node.head === prevNode.tail && prevNode.head === node.tail &&
        prevNode.depth === node.depth
      ) {
        deadEnd = true;
        return [];
      }

      node.majorVersion = parseInt((node.majorVersion as unknown) as string);
      node.txId = txId;
      node.depth = parseInt((node.depth as unknown) as string) as 0;
      node.createdAt = new Date(node.createdAt);

      // Set the tail node to be conservative.
      if (!lastWasBranch && isBranch) {
        branchTailNode = prevNode;
      }

      if (lastWasBranch && !isBranch) {
        if (!branchTailNode) {
          const { branchTail } = node as RDTBranchNode;
          branchTailNode = await getNode(
            client,
            { root, depth: prevNode.depth - 1, head: branchTail },
          );
        }

        if (branchTailNode.createdAt.getTime() < node.createdAt.getTime()) {
          deadEnd = true;
          return [];
        }
      }

      lastWasBranch = isBranch;
      prevNode = node;

      return node;
    }),
  );

  // @ts-expect-error
  nodes = nodes.length === 1 ? nodes[0] : nodes;

  return nodes as D extends 0 ? F extends false ? RDTNode
  : RDTNode[]
    : F extends false ? RDTBranchNode
    : RDTBranchNode[];
}

interface GetNodeWithDirOpts<D extends number> {
  node: RDTNode;
  depth?: D;
  walletAddr?: string;
}

export function getTailNode(
  client: Arweave,
  opts: GetNodeWithDirOpts<0>,
): Promise<RDTNode>;
export function getTailNode(
  client: Arweave,
  opts: GetNodeWithDirOpts<number>,
): Promise<RDTBranchNode>;
export function getTailNode<D extends number>(
  client: Arweave,
  { node, depth = 0 as D, walletAddr }: GetNodeWithDirOpts<D>,
) {
  const { root, tail } = node;
  return getNode(client, { root, depth, head: tail, walletAddr });
}

export function getHeadNode(
  client: Arweave,
  opts: GetNodeWithDirOpts<0>,
): Promise<RDTNode>;
export function getHeadNode(
  client: Arweave,
  opts: GetNodeWithDirOpts<number>,
): Promise<RDTBranchNode>;
export function getHeadNode<D extends number>(
  client: Arweave,
  { node, depth = 0 as D, walletAddr }: GetNodeWithDirOpts<D>,
) {
  const { root, head } = node;
  return getNode(client, { root, depth, tail: head, walletAddr });
}

interface TraverseNodesOpts<M extends number> {
  entryNode: RDTNode;

  // Amount of nodes to traverse, Infinity is permitted.
  // Use positive or negative numbers to indicate direction.
  amount: number;

  // If we encounter a branch and this option is set > 0,
  // we will traverse the branch we encounter.
  // If we encounter a branch while on a branch, depending
  // on the current branch depth, we'll switch over to it.
  // If a branch is a dead end, we continue from the head node
  // relative to the entry point of which this branch was traversed
  // from.
  maxBranchDepth?: M;

  walletAddr?: string;
}

export function traverseNodes(
  client: Arweave,
  opts: TraverseNodesOpts<0>,
): AsyncGenerator<RDTNode>;
export function traverseNodes(
  client: Arweave,
  opts: TraverseNodesOpts<number>,
): AsyncGenerator<RDTNode | RDTBranchNode>;
export async function* traverseNodes<D extends number>(
  client: Arweave,
  {
    entryNode,
    amount,
    maxBranchDepth = 0 as D,
    walletAddr,
  }: TraverseNodesOpts<D>,
): AsyncGenerator<RDTNode | RDTBranchNode> {
  if (!amount) return;
  const forward = Math.sign(amount) > 0 ? true : false;
  amount = Math.abs(amount);

  while (--amount) {
    const res = await (forward ? getHeadNode : getTailNode)(client, {
      node: entryNode,
      depth: maxBranchDepth,
      walletAddr,
    });

    yield res;
  }
}
