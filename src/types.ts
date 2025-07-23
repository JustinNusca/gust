import { TypeStyle } from "@figma/rest-api-spec";

export interface EffectToken {
  type: "custom-shadow";
  value: {
    color: string;
    offsetX: number;
    offsetY: number;
    radius: number;
    shadowType: "dropShadow";
    spread: number;
  };
}

export interface PaletteToken {
  id: string;
  name: string;
  type: "COLOR" | "color";
  value: string;
}

export interface FontToken {
  id: string;
  name: string;
  type: "TEXT";
  value: TypeStyle;
}

export interface GradientStop {
  position: number;
  color: string;
}

export interface GradientToken {
  type: "custom-gradient";
  value: {
    gradientType: "linear";
    rotation: number;
    stops: GradientStop[];
  };
}

export interface GridToken {
  type: "custom-grid";
  value: {
    alignment: number;
    count: number;
    gutterSize: number;
    offset?: number;
    pattern: "columns";
    sectionSize?: number;
  };
}

export type Token =
  | EffectToken
  | FontToken
  | GradientToken
  | GridToken
  | PaletteToken;

export interface Tokens {
  effect?: Record<string, EffectToken>;
  font?: Record<string, FontToken>;
  typography?: Record<string, FontToken>;
  gradient?: Record<string, GradientToken>;
  [key: string]: unknown;
}
