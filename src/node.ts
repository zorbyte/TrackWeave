import { RDTRootNode, ROOT_NODE_TAG_MAP, AbstractRDTRootNode } from "./root";
import { TagMap, fetchTags, mapTagsToValues } from "./tags";
import { RDTBranchNode, BRANCH_NODE_TAG_MAP } from "./branch";
import { Arweave, genTargetWalletOps } from "./utils";
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
  walletDirs?: ("to" | "from")[];

  tags?: Record<string, string>;
}

export async function getNode(
  client: Arweave,
  opts: GetNodeOpts<0, false>,
): Promise<RDTRootNode<NodeType> | undefined>;
export async function getNode(
  client: Arweave,
  opts: GetNodeOpts<0, true>,
): Promise<RDTRootNode<NodeType>[] | undefined>;
export async function getNode(
  client: Arweave,
  opts: GetNodeOpts<number, false>,
): Promise<RDTBranchNode | undefined>;
export async function getNode(
  client: Arweave,
  opts: GetNodeOpts<number, true>,
): Promise<RDTBranchNode[] | undefined>;
export async function getNode<D extends number, F extends boolean>(
  client: Arweave,
  {
    root,
    tail,
    head,
    depth = 0 as D,
    fetchGreedily = false as F,
    walletAddr,
    walletDirs = ["to", "from"],
    tags,
  }: GetNodeOpts<D, F>,
) {
  if (tail === head) {
    throw new TypeError("Argument error: Tail ID is the same as Head ID");
  }

  if (!tail && !head) {
    throw new TypeError("Insufficient arguments: tail or head must be defined");
  }

  const prev: ArqlOp[] = [];
  const curr: ArqlOp[] = [equals("Branch-Depth", depth.toString())];
  const next: ArqlOp[] = [];
  const query: ArqlOp[] = [
    equals("Root-Id", typeof root === "string" ? root : root.root),
    ...(tags
      ? Object.entries(tags).map(([key, value]) => equals(key, value))
      : []),
  ];

  // This chain concerns this wallet addr.
  if (walletAddr) {
    curr.push(...genTargetWalletOps(walletAddr, walletDirs));
  }

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

  let prevNode: RDTRootNode<NodeType> | RDTBranchNode | undefined;
  let lastWasBranch = false;
  let doNotContinue = false;
  let branchTailNode: RDTNode | undefined;
  const txIds = await client.arql(and(...query));
  if (!txIds.length) return;
  let nodes = await Promise.all(
    txIds.flatMap(async (txId) => {
      if (doNotContinue) return [];

      const tags = await fetchTags(client, txId);
      const isBranch = !!tags["Branch-Tail-Node"];
      const node = mapTagsToValues(
        isBranch ? BRANCH_NODE_TAG_MAP : NODE_TAG_MAP,
        tags,
      );

      // Detect circular that doesn't use branches.
      if (
        prevNode &&
        typeof (prevNode as RDTNode).depth !== "undefined" &&
        node.head === prevNode.tail &&
        prevNode.head === node.tail &&
        (prevNode as RDTNode).depth === node.depth
      ) {
        doNotContinue = true;
        return [];
      }

      node.majorVersion = parseInt((node.majorVersion as unknown) as string);
      node.txId = txId;
      node.depth = parseInt((node.depth as unknown) as string) as 0;
      node.createdAt = new Date(node.createdAt);

      // Set the tail node to be conservative.
      if (
        prevNode &&
        !lastWasBranch &&
        isBranch &&
        prevNode.head === (node as RDTBranchNode).branchTail
      ) {
        branchTailNode = prevNode as RDTNode;
      }

      // If we're on a branch rejoin and we were traversing said rejoining branch,
      // verify the chronology of the rejoin.
      if (
        prevNode &&
        lastWasBranch &&
        !isBranch &&
        prevNode.head === node.tail
      ) {
        if (!branchTailNode) {
          const { branchTail } = (prevNode as RDTBranchNode | undefined) ?? {};
          // Something is definitely wrong here, as branches need a branchTail.
          if (!branchTail) return [];
          branchTailNode = await getNode(client, {
            root,
            depth: (prevNode as RDTBranchNode).depth - 1,
            head: branchTail,
          });
        }

        if (branchTailNode!.createdAt.getTime() > node.createdAt.getTime()) {
          doNotContinue = true;
          return [];
        }
      }

      lastWasBranch = isBranch;
      prevNode = node;

      return node;
    }),
  );

  // @ts-expect-error
  nodes = depth === 0 && nodes.length === 1 ? nodes[0] : nodes;

  return nodes as D extends 0 ? F extends false ? RDTRootNode<NodeType>
  : RDTRootNode<NodeType>[]
    : F extends false ? RDTBranchNode
    : RDTBranchNode[];
}

interface GetNodeWithDirOpts<D extends number> {
  node: RDTRootNode<NodeType>;
  depth?: D;
  walletAddr?: string;
}

export function getTailNode(
  client: Arweave,
  opts: GetNodeWithDirOpts<0>,
): Promise<RDTRootNode<NodeType> | undefined>;
export function getTailNode(
  client: Arweave,
  opts: GetNodeWithDirOpts<number>,
): Promise<RDTBranchNode | undefined>;
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
): Promise<RDTNode | undefined>;
export function getHeadNode(
  client: Arweave,
  opts: GetNodeWithDirOpts<number>,
): Promise<RDTBranchNode | undefined>;
export function getHeadNode<D extends number>(
  client: Arweave,
  { node, depth = 0 as D, walletAddr }: GetNodeWithDirOpts<D>,
) {
  const { root, head } = node;
  return getNode(client, { root, depth, tail: head, walletAddr });
}

interface TraverseNodesOpts<M extends number> {
  entryNode: RDTRootNode<NodeType>;

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
): AsyncGenerator<RDTRootNode<NodeType>>;
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
): AsyncGenerator<RDTRootNode<NodeType> | RDTBranchNode> {
  if (!amount) return;
  const forward = Math.sign(amount) > 0 ? true : false;
  if (!entryNode.tail && !forward) return;
  amount = Math.abs(amount);

  let node = entryNode;
  while (--amount) {
    const res = (await (forward ? getHeadNode : getTailNode)(client, {
      node,
      depth: maxBranchDepth,
      walletAddr,
    })) as RDTRootNode<NodeType> | RDTBranchNode;

    if (!res || !res.tail) return;
    node = res;

    yield res;
  }
}
