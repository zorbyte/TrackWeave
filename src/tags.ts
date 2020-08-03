import { RDTRootNode } from "./root";
import { invertObj, Arweave } from "./utils";
import { Tag } from "arweave/node/lib/transaction";
import { NodeType } from ".";

export type TagMap<N extends RDTRootNode<NodeType>> = {
  [K in keyof Omit<N, typeof DEFAULT_IGNORED_KEYS[number]>]-?: string;
};

type TagType<M extends TagMap<RDTRootNode>> = M extends TagMap<infer T>
  ? T
  : never;

const DEFAULT_IGNORED_KEYS = ["txId", "otherTags", "waypoint"] as const;

export function mapTagsToValues<
  M extends TagMap<RDTRootNode>,
  T extends TagType<M>
>(tagMap: M, tags: Record<string, string>): T {
  const mapped = {} as T;
  const inverted = getInverted(tagMap);

  const mappedKeys = [];

  for (const [key, value] of Object.entries(tags)) {
    const mappableKey = inverted[key];
    if (!mappableKey) {
      if (!mapped.otherTags) mapped.otherTags = {};
      mapped.otherTags[key] = (value as unknown) as string;
    }

    mapped[mappableKey as keyof T] = (value as unknown) as T[keyof T];
    mappedKeys.push(key);
  }

  return mapped;
}

// TODO(@zorbyte): Create types for this.
export function mapValuesToTags<
  N extends RDTRootNode<NodeType>,
  M extends TagMap<N>
>(tagMap: M, node: N): Record<string, string> {
  let result = {} as Record<string, string>;
  const { otherTags = {} } = node;

  for (const [key, value] of Object.entries(node)) {
    const resultKey = tagMap[key as keyof M];
    if (!resultKey) continue;
    result[resultKey] = value.toString?.() ?? `${value}`;
  }

  result = { ...result, ...otherTags };

  return result;
}

export async function fetchTags(client: Arweave, txId: string) {
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

// Unfortunately typescript can not reflect inverted objects AFAIK.
// TODO(@zorbyte): Investigate alternatives.
const invertedTagMaps = new WeakMap<TagMap<RDTRootNode>, any>();
function getInverted<N extends RDTRootNode, M extends TagMap<N>>(tagMap: M) {
  let inverted: { [k: string]: keyof M } = invertedTagMaps.get(tagMap);
  if (!inverted) {
    inverted = invertObj(invertObj);
    invertedTagMaps.set(tagMap, inverted);
  }

  return inverted;
}
