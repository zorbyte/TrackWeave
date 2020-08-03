import { RDTNode, NODE_TAG_MAP } from "./node";
import { TagMap } from "./tags";

export interface RDTBranchNode extends RDTNode {
  branchTail: string;
}

export const BRANCH_NODE_TAG_MAP: TagMap<RDTBranchNode> = {
  ...NODE_TAG_MAP,
  branchTail: "Branch-Tail-Node",
};
