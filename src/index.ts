import { RDTBranchNode, BRANCH_NODE_TAG_MAP } from "./branch";
import {
  RDTNode,
  NODE_TAG_MAP,
  getNode,
  getTailNode,
  getHeadNode,
  traverseNodes,
} from "./node";
import { RDTRootNode, ROOT_NODE_TAG_MAP, findRootNode } from "./root";

import { nanoid } from "nanoid";
import { mapValuesToTags } from "./tags";

export const MAJOR_VERSION = 0;

export type RDTAnyNode = RDTRootNode<NodeType>;
export const enum NodeType {
  Root = "root",
  Node = "node",
}

export function createRootNode(): RDTAnyNode;
export function createRootNode<N extends RDTAnyNode>(
  tailNode: N,
): RDTRootNode & { tail: string };
export function createRootNode<N extends RDTAnyNode>(tailNode?: N) {
  const rootNode: RDTRootNode = {
    type: NodeType.Root,
    root: nanoid(),
    majorVersion: MAJOR_VERSION,
    createdAt: new Date(),
    head: nanoid(),
    otherTags: {},
  };

  if (tailNode?.head) rootNode.tail = tailNode?.head;

  return rootNode;
}

export function createNode<N extends RDTAnyNode>(
  tailNode: N,
  createBranch: true,
): RDTBranchNode;
export function createNode<N extends RDTAnyNode>(
  tailNode: N,
  createBranch: false,
): RDTNode;
export function createNode<N extends RDTAnyNode>(
  tailNode: N,
  createBranch = false,
) {
  const { depth } = (tailNode as unknown) as RDTNode;

  const baseNode: RDTNode = {
    type: NodeType.Node,
    root: tailNode.root,
    depth: !!depth ? (createBranch ? depth + 1 : depth) : 0,
    majorVersion: MAJOR_VERSION,
    createdAt: new Date(),
    tail: tailNode.head,
    head: nanoid(),
    otherTags: {},
  };

  if (createBranch) {
    (baseNode as RDTBranchNode).branchTail = baseNode.head;
    return baseNode as RDTBranchNode;
  }

  return baseNode;
}

export function getNodeTags<N extends RDTAnyNode>(node: N) {
  // @ts-expect-error
  node.createdAt = node.createdAt.getTime();
  const tags = mapValuesToTags(
    ((node as unknown) as RDTBranchNode).branchTail
      ? BRANCH_NODE_TAG_MAP
      : ((node as unknown) as RDTNode).depth
      ? NODE_TAG_MAP
      : ROOT_NODE_TAG_MAP,
    node as RDTAnyNode,
  );

  return tags;
}

export { RDTRootNode, findRootNode };

export { RDTNode, getNode, getTailNode, getHeadNode, traverseNodes };

export { RDTBranchNode };
