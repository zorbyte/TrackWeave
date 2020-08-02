import ArweaveNode from "arweave/node";
import ArweaveWeb from "arweave/web";

import { and, equals, ArqlOp } from "arql-ops";
import { Tag } from "arweave/node/lib/transaction";

type Arweave = ArweaveNode | ArweaveWeb;

export const enum NodeType {
  Root = "root",
  Node = "node",
}

export interface RDTRootNode {
  txId?: string;

  type: NodeType;
  majorVersion: number;

  root: string;
  createdAt: Date;

  tail?: string;
  head: string;

  otherTags?: Record<string, string>;
}

export interface RDTNode extends RDTRootNode {
  depth: 0;
  tail: string;
  waypoint: {
    tail: string;
    head: string;
  };
}

export interface RDTBranchNode extends RDTNode {
  branchTail: string;
}

type AbstractRTDRootNode = string | RDTRootNode;

/* Mapping keys */

type MappableRDTNode<N extends RDTNode> = Omit<N, "waypoint"> & {
  waypointTail: string;
  waypointHead: string;
};

type TagMap<N extends RDTRootNode> = {
  [K in keyof Omit<N, typeof DEFAULT_IGNORED_KEYS[number]>]-?: string;
};

const DEFAULT_IGNORED_KEYS = ["txId", "otherTags", "waypoint"] as const;
const ROOT_NODE_TAG_MAP: TagMap<RDTRootNode> = {
  type: "RDT-Type",
  majorVersion: "RDT-Major-Version",

  root: "Root-Id",
  createdAt: "Created-At",

  tail: "Tail-Node",
  head: "Head-Node",
};

const NODE_TAG_MAP: TagMap<MappableRDTNode<RDTNode>> = {
  ...ROOT_NODE_TAG_MAP,
  depth: "Branch-Depth",
  waypointTail: "Waypoint-Tail",
  waypointHead: "Waypoint-Head",
};

const BRANCH_NODE_TAG_MAP: TagMap<MappableRDTNode<RDTBranchNode>> = {
  ...NODE_TAG_MAP,
  branchTail: "Branch-Tail-Node",
};

export interface ConfigOpts {
  // Saves branch txIds during regular traversal.
  saveBranchEncounters: boolean;
}

let client: Arweave | undefined;
let saveBranchEncounters = true;
const branchEncounters = new Map<string, string>();
export function config(
  arweaveClient: Arweave,
  opts: ConfigOpts = { saveBranchEncounters: true }
) {
  client = arweaveClient;

  saveBranchEncounters = opts.saveBranchEncounters;
}

interface FindRootNodeOpts {
  // Either the id of the root node, or a node with the root node ID.
  abstractNode?: AbstractRTDRootNode;
  walletAddr?: string;
}

export async function findRootNode({
  abstractNode,
  walletAddr,
}: FindRootNodeOpts) {
  assertClient(client);
  if (!abstractNode && !walletAddr) {
    throw new TypeError(
      "Insufficient arguments: abstractNode and/or walletAddr must be provided"
    );
  }
  const exprs = [equals("RDT-Type", NodeType.Root)];
  if (walletAddr) exprs.push(equals("from", walletAddr));
  if (typeof abstractNode === "string") {
    exprs.push(equals("Root-Id", abstractNode));
  } else if (true) {
  }

  const query = and(...exprs);

  const txIds = await client.arql(query);

  // Get oldest one, as others are not the original.
  const txId = txIds[txIds.length - 1];

  const tags = await fetchTags(txId);
  const mapped = mapTags(tags, ROOT_NODE_TAG_MAP);

  return mapped;
}

interface GetNodeOpts {
  tail?: string;
  head?: string;

  depth?: number;

  // Get the surrounding nodes if possible.
  // i.e. node(.., head: a) - node(tail: a, head: b) - node(tail: b, ...)
  //      All nodes will be collected.
  fetchGreedily?: boolean;
  walletAddr?: string;
}

export async function getNode<D extends number, F extends boolean>(
  rootNode: AbstractRTDRootNode,
  {
    tail,
    head,
    depth = 0 as D,
    fetchGreedily = false as F,
    walletAddr,
  }: GetNodeOpts & { depth?: D; fetchGreedily?: F }
): Promise<
  D extends 0
    ? F extends false
      ? RDTNode
      : RDTNode[]
    : F extends false
    ? RDTBranchNode
    : RDTBranchNode[]
> {
  assertClient(client);
  if (!tail && !head) {
    throw new TypeError("Insufficient arguments: tail or head must be defined");
  }

  const prev: ArqlOp[] = [];
  const curr: ArqlOp[] = [];
  const next: ArqlOp[] = [];
  const query: ArqlOp[] = [
    equals("Root-Id", typeof rootNode === "string" ? rootNode : rootNode.root),
    equals("Branch-Depth", depth.toString()),
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

  query.push(...combined);

  const txIds = await client.arql(query);

  const nodes = await Promise.all(
    txIds.map(async (txId) => {
      const tags = await fetchTags(txId);
      const mapped = mapTags(
        tags,
        depth > 0 ? BRANCH_NODE_TAG_MAP : NODE_TAG_MAP
      );
      const { waypointTail, waypointHead } = mapped;
      delete mapped.waypointTail;
      delete mapped.waypointHead;

      const node = (mapped as unknown) as RDTNode;

      node.waypoint.tail = waypointTail;
      node.waypoint.head = waypointHead;

      return node;
    })
  );

  return nodes as any;
}

export function getTailNode(node: RDTNode, walletAddr?: string) {
  const { root, tail } = node;
  return getNode(root, { tail, walletAddr });
}

export function getHeadNode(node: RDTNode, walletAddr?: string) {
  const { root, tail } = node;
  return getNode(root, { tail, walletAddr });
}

interface TraverseNodesOpts {
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
  maxBranchDepth?: number;

  // If we're on a branch:
  // Stop traversing the nodes along the branch if:
  //   a. "head" - We reach the head node (node at which we rejoin).
  //   b. "last-tail" - We find the end of the branch.
  //      Does not collect info on the node it rejoins at.
  //   c. By not providing this option, traversal will continue at rejoin.
  stopBranchAt?: "head" | "last-tail";
}

export async function* traverseNodes(
  entryNode: RDTBranchNode,
  { amount, maxBranchDepth = 0, stopBranchAt }: TraverseNodesOpts
) {
  if (!amount) return;
  const forward = Math.sign(amount) > 0 ? true : false;
  amount = Math.abs(amount);

  while (--amount) {
    // const txs;
    // TODO
  }
}

export function getBranches(node: RDTNode) {}

// export function findWaypoint(node: RDTNode, forward: boolean) {}

type TagType<M extends TagMap<RDTRootNode>> = M extends TagMap<infer T>
  ? T
  : never;

// Unfortunately typescript can not reflect inverted objects AFAIK.
// TODO(@zorbyte): Fix this issue, as the current method has horrible performance penalties.
const invertedTagMaps = new WeakMap<TagMap<RDTRootNode>, any>();
function mapTags<M extends TagMap<RDTRootNode>, T extends TagType<M>>(
  tags: Record<string, string>,
  tagMap: M
): T {
  const mapped = {} as T;
  let inverted: { [k: string]: keyof T } = invertedTagMaps.get(tagMap);
  if (!inverted) {
    inverted = invertObj(invertObj);
    invertedTagMaps.set(tagMap, inverted);
  }

  const mappedKeys = [];

  for (const [key, value] of (Object.entries(tags) as unknown) as [
    string,
    T[keyof T]
  ][]) {
    const mappableKey = inverted[key];
    if (!mappableKey) {
      if (!mapped.otherTags) mapped.otherTags = {};
      mapped.otherTags[key] = (value as unknown) as string;
    }

    mapped[inverted[key]] = value;
    mappedKeys.push(key);
  }

  return mapped;
}

async function fetchTags(txId: string) {
  assertClient(client);
  const { status, statusText, data } = await client.api.get(txId);

  if (status >= 300) throw new Error(`${status}: ${statusText}`);

  const tags = Object.fromEntries(
    (data as Tag[]).map((rawTag) => [
      client!.utils.b64UrlToString(rawTag.name),
      client!.utils.b64UrlToString(rawTag.value),
    ])
  );

  return tags as Record<string, string>;
}

function assertClient(client: Arweave | undefined): asserts client is Arweave {
  if (typeof client === "undefined") {
    throw new TypeError(
      "Arweave client must be provided through config(Arweave.init(...), [...])"
    );
  }
}

function invertObj(obj: Object) {
  return Object.entries(obj).reduce((res, entry) => {
    const [key, value] = entry;
    res[value] = key;
    return res;
  }, {} as Record<any, any>);
}
