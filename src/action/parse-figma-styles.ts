import type {
  Effect,
  LayoutGrid,
  Node,
  Paint,
  StyleType,
  TypeStyle,
} from "@figma/rest-api-spec";

import type { FigmaResources } from "#util/figma-api";

export interface ParsedFigmaStyle {
  key: string;
  nodeId: string;
  name: string;
  description: string;
  styleType: StyleType;
  remote: boolean;
  effects: Effect[];
  fills: Paint[];
  layoutGrids: LayoutGrid[];
  /** Source-node width in pixels, when the node carries an absolute bounding box. */
  nodeWidth?: number;
  textStyle?: TypeStyle;
}

export type ParsedFigmaStyles = Record<string, ParsedFigmaStyle>;

function pickEffects(node: Node | undefined): Effect[] {
  if (node && "effects" in node && Array.isArray(node.effects)) {
    return node.effects;
  }
  return [];
}

function pickFills(node: Node | undefined): Paint[] {
  if (node && "fills" in node && Array.isArray(node.fills)) {
    return node.fills;
  }
  return [];
}

function pickTextStyle(node: Node | undefined): TypeStyle | undefined {
  return node?.type === "TEXT" ? node.style : undefined;
}

function pickLayoutGrids(node: Node | undefined): LayoutGrid[] {
  if (node && "layoutGrids" in node && Array.isArray(node.layoutGrids)) {
    return node.layoutGrids;
  }
  return [];
}

function pickNodeWidth(node: Node | undefined): number | undefined {
  if (!node || !("absoluteBoundingBox" in node)) return undefined;
  const box = node.absoluteBoundingBox;
  return typeof box?.width === "number" ? box.width : undefined;
}

/**
 * Joins each collected published style (local + remote/library) with its
 * source node so downstream resolvers can read the actual paint/effect/type
 * information. Styles whose source node couldn't be fetched are still
 * included with empty paint/effect data.
 */
export function parseFigmaStyles(resources: FigmaResources): ParsedFigmaStyles {
  const parsed: ParsedFigmaStyles = {};

  for (const style of resources.styles) {
    const node = resources.nodes[style.key];
    parsed[style.key] = {
      description: style.description,
      effects: pickEffects(node),
      fills: pickFills(node),
      key: style.key,
      layoutGrids: pickLayoutGrids(node),
      name: style.name,
      nodeId: style.node_id,
      nodeWidth: pickNodeWidth(node),
      remote: style.remote,
      styleType: style.style_type,
      textStyle: pickTextStyle(node),
    };
  }

  return parsed;
}
