export type Palette =
  | "fresh-green"
  | "ocean"
  | "berry"
  | "sunset"
  | "midnight"
  | "charcoal";

export type FontPair = "friendly" | "classic" | "modern" | "warm";
export type Corners = "soft" | "sharp" | "round";
export type Density = "compact" | "comfortable" | "airy";
export type Rhythm = "even" | "alternate" | "tinted" | "bold";

export type ThemeColors = {
  primary: string;
  accent: string;
  background: string;
  text: string;
  soft: string;
  onPrimary?: string;
};

export type Theme = {
  version?: number;
  presetId?: string | null;
  palette?: Palette | string;
  fontPair?: FontPair | string;
  corners?: Corners;
  colorMode?: "light" | "dark";
  density?: Density;
  colors?: Partial<ThemeColors>;
  fonts?: {
    heading: { id: string; weight?: number };
    body: { id: string; weight?: number };
    scale?: "compact" | "comfortable" | "large";
  };
  buttons?: {
    shape?: "square" | "soft" | "round" | "pill";
    style?: "solid" | "outline" | "soft";
    size?: "normal" | "large";
    uppercase?: boolean;
    shadow?: boolean;
  };
  cards?: {
    style?: "flat" | "outlined" | "shadow";
  };
  header?: {
    style?: string;
    sticky?: boolean;
  };
  footer?: {
    style?: string;
  };
  design?: {
    rhythm?: Rhythm;
    buttonShape?: "square" | "soft" | "round" | "pill";
    buttonStyle?: "solid" | "outline" | "soft";
    buttonSize?: "normal" | "large";
    cardStyle?: "flat" | "outlined" | "shadow";
    imageStyle?: "rounded" | "sharp" | "arch" | "offset" | "circle";
    align?: "left" | "center";
  };
};

export type LinkTarget =
  | { type: "none" }
  | { type: "page"; pageId?: string }
  | { type: "url"; url?: string }
  | { type: "email"; email?: string; address?: string }
  | { type: "phone"; phone?: string; number?: string }
  | { type: "anchor"; anchor?: string }
  | { type: "section"; anchor?: string };

export type BlockSectionStyle = {
  anchor?: string;
  background?: "default" | "soft" | "primary" | "dark";
  padding?: "none" | "compact" | "normal" | "spacious";
  shape?: {
    top?: string;
    bottom?: string;
  };
};

export type Block = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  sec?: BlockSectionStyle;
  sampleOnly?: boolean;
  includeIf?: string;
};

export type Declarations = Record<string, string>;

export type StyleSet = {
  base?: Declarations;
  hover?: Declarations;
  focus?: Declarations;
  active?: Declarations;
  tablet?: Declarations;
  phone?: Declarations;
};

export type NodeType =
  | "page"
  | "section"
  | "section-item"
  | "container"
  | "columns"
  | "column"
  | "stack"
  | "grid"
  | "list"
  | "heading"
  | "text"
  | "richtext"
  | "image"
  | "video"
  | "icon"
  | "button"
  | "divider"
  | "spacer"
  | "accordion"
  | "accordion-item"
  | "html"
  | "smart"
  | "reference";

export type RichMark = {
  type: "bold" | "italic" | "underline" | "strike" | "code" | "link" | string;
  attrs?: Record<string, unknown>;
};

export type RichTextLeaf = {
  type: "text";
  text: string;
  marks?: RichMark[];
};

export type RichNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: Array<RichNode | RichTextLeaf>;
  text?: string;
  marks?: RichMark[];
};

export type DeviceVisibility = {
  all?: boolean;
  computer?: boolean;
  tablet?: boolean;
  phone?: boolean;
  [key: string]: boolean | undefined;
};

export type ContentNode = {
  id: string;
  type: NodeType;
  props?: Record<string, unknown>;
  styles?: StyleSet;
  classes?: string[];
  attrs?: {
    id?: string;
    ariaLabel?: string;
    [key: string]: unknown;
  };
  children?: ContentNode[];
  requiresPlugin?: string;
  locked?: boolean;
  hidden?: boolean | DeviceVisibility;
  note?: string;
};

export type PageContentV5 = {
  schemaVersion: 5;
  root: ContentNode;
  css?: string;
  meta?: {
    migratedFrom?: number;
    [key: string]: unknown;
  };
};
