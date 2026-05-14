import type {
  GetFileNodesResponse,
  GetFileResponse,
  GetFileStylesResponse,
  GetLocalVariablesResponse,
  GetMeResponse,
  GetStyleResponse,
  Node,
  PublishedStyle,
  StyleType,
} from "@figma/rest-api-spec";

import { getFigmaToken } from "#util/credentials";

/**
 * The shape every collected style is normalized to: enough metadata to
 * fetch the source node and to drive the downstream parsers. We don't
 * use `PublishedStyle` directly because some sources (the top-level
 * `styles` map on `/files/:key`) don't expose every field that type
 * requires.
 */
export interface CollectedStyle {
  key: string;
  file_key: string;
  node_id: string;
  style_type: StyleType;
  name: string;
  description: string;
  /** True when the style is owned by a different file (linked library). */
  remote: boolean;
}

export interface FigmaResources {
  styles: CollectedStyle[];
  variables: GetLocalVariablesResponse;
  /** Source style nodes (one per collected style), keyed by the style's global `key`. */
  nodes: Record<string, Node>;
}

const BASE_URL = "https://api.figma.com/v1";

export class FigmaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Figma API request failed (${status}): ${body}`);
    this.name = "FigmaApiError";
  }
}

async function fetchFigma<T>(
  path: string,
  query?: Record<string, string>,
  tokenOverride?: string,
): Promise<T> {
  const token = tokenOverride ?? (await getFigmaToken());
  if (!token) {
    throw new Error(
      "No Figma access token is configured. Run `gust login` to save one, or set FIGMA_ACCESS_TOKEN.",
    );
  }

  const url = new URL(`${BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    headers: { "X-Figma-Token": token },
  });

  if (!response.ok) {
    throw new FigmaApiError(response.status, await response.text());
  }

  return (await response.json()) as T;
}

export async function getMe(tokenOverride?: string): Promise<GetMeResponse> {
  return fetchFigma("/me", undefined, tokenOverride);
}

export async function getFile(key: string): Promise<GetFileResponse> {
  return fetchFigma(`/files/${encodeURIComponent(key)}`);
}

export async function getFileStyles(
  key: string,
): Promise<GetFileStylesResponse> {
  return fetchFigma(`/files/${encodeURIComponent(key)}/styles`);
}

export async function getFileLocalVariables(
  key: string,
): Promise<GetLocalVariablesResponse> {
  return fetchFigma(`/files/${encodeURIComponent(key)}/variables/local`);
}

export async function getFileNodes(
  key: string,
  ids: string,
): Promise<GetFileNodesResponse> {
  return fetchFigma(`/files/${encodeURIComponent(key)}/nodes`, { ids });
}

export async function getStyle(key: string): Promise<GetStyleResponse> {
  return fetchFigma(`/styles/${encodeURIComponent(key)}`);
}

function publishedStyleToCollected(
  style: PublishedStyle,
  remote: boolean,
): CollectedStyle {
  return {
    key: style.key,
    file_key: style.file_key,
    node_id: style.node_id,
    style_type: style.style_type,
    name: style.name,
    description: style.description,
    remote,
  };
}

/**
 * Loads everything the parser pipeline needs from Figma. We pull styles
 * from three complementary sources because no single endpoint covers
 * every case:
 *
 * - `/files/:key/styles` — local styles that have been published as part
 *   of this file's library. Empty when the file isn't published.
 * - The top-level `styles` map on `/files/:key` — every style referenced
 *   anywhere in the document, including unpublished local styles and
 *   library styles. Keyed by node_id (the source-file node), with a
 *   `remote` flag.
 * - `/styles/:key` — used to resolve remote style keys to their owning
 *   file so we can fetch the source node from the right library.
 *
 * Source nodes are then fetched per owning file in parallel.
 *
 * `getStyle` lookups for unreachable remote styles (deleted, permission
 * denied, etc.) are tolerated — that style is dropped from the result.
 */
export async function fetchFigmaResources(
  documentId: string,
): Promise<FigmaResources> {
  const [publishedLocal, file, variables] = await Promise.all([
    getFileStyles(documentId),
    getFile(documentId),
    getFileLocalVariables(documentId),
  ]);

  const styles: CollectedStyle[] = publishedLocal.meta.styles.map((style) =>
    publishedStyleToCollected(style, false),
  );
  const seenKeys = new Set(styles.map((s) => s.key));

  // Local styles referenced in the document that aren't in the published
  // library set. The map key on `file.styles` is the style's node_id in
  // this file.
  for (const [nodeId, meta] of Object.entries(file.styles)) {
    if (meta.remote || seenKeys.has(meta.key)) continue;
    styles.push({
      key: meta.key,
      file_key: documentId,
      node_id: nodeId,
      style_type: meta.styleType,
      name: meta.name,
      description: meta.description,
      remote: false,
    });
    seenKeys.add(meta.key);
  }

  // Remote (library) styles — resolve each to its owning file via
  // /styles/:key so we can fetch nodes from the right library.
  const remoteKeys = Object.values(file.styles)
    .filter((s) => s.remote && !seenKeys.has(s.key))
    .map((s) => s.key);

  const remoteStyles = (
    await Promise.all(
      remoteKeys.map((key) =>
        getStyle(key)
          .then((res) => res.meta)
          .catch(() => null),
      ),
    )
  ).filter((s): s is PublishedStyle => s !== null);

  for (const style of remoteStyles) {
    if (seenKeys.has(style.key)) continue;
    styles.push(publishedStyleToCollected(style, true));
    seenKeys.add(style.key);
  }

  const byFile = new Map<string, CollectedStyle[]>();
  for (const style of styles) {
    const bucket = byFile.get(style.file_key);
    if (bucket) bucket.push(style);
    else byFile.set(style.file_key, [style]);
  }

  const nodes: Record<string, Node> = {};
  await Promise.all(
    [...byFile.entries()].map(async ([fileKey, fileStyles]) => {
      const ids = fileStyles.map((s) => s.node_id).join(",");
      if (!ids) return;
      const response = await getFileNodes(fileKey, ids);
      for (const style of fileStyles) {
        const doc = response.nodes[style.node_id]?.document;
        if (doc) nodes[style.key] = doc;
      }
    }),
  );

  return { styles, variables, nodes };
}
