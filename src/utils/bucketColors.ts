/**
 * Bucket Color Utilities
 *
 * Color definitions for visual bucket organization.
 * Matches the d1-manager color palette for consistency.
 */

/**
 * Available bucket color values
 */
export type BucketColor =
  | "red"
  | "red-light"
  | "red-dark"
  | "orange"
  | "orange-light"
  | "amber"
  | "yellow"
  | "yellow-light"
  | "lime"
  | "green"
  | "green-light"
  | "emerald"
  | "teal"
  | "cyan"
  | "sky"
  | "blue"
  | "blue-light"
  | "indigo"
  | "purple"
  | "violet"
  | "fuchsia"
  | "pink"
  | "rose"
  | "pink-light"
  | "gray"
  | "slate"
  | "zinc"
  | null;

/**
 * Color configuration with CSS classes and labels
 */
export interface ColorConfig {
  value: Exclude<BucketColor, null>;
  label: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
}

/**
 * Available bucket colors with their display properties
 * Organized in rows by hue family for intuitive selection
 */
export const BUCKET_COLORS: ColorConfig[] = [
  // Row 1: Reds & Pinks
  {
    value: "red-light",
    label: "Light Red",
    bgClass: "bg-red-400",
    borderClass: "border-red-400",
    textClass: "text-red-400",
  },
  {
    value: "red",
    label: "Red",
    bgClass: "bg-red-500",
    borderClass: "border-red-500",
    textClass: "text-red-500",
  },
  {
    value: "red-dark",
    label: "Dark Red",
    bgClass: "bg-red-700",
    borderClass: "border-red-700",
    textClass: "text-red-700",
  },
  {
    value: "rose",
    label: "Rose",
    bgClass: "bg-rose-500",
    borderClass: "border-rose-500",
    textClass: "text-rose-500",
  },
  {
    value: "pink-light",
    label: "Light Pink",
    bgClass: "bg-pink-400",
    borderClass: "border-pink-400",
    textClass: "text-pink-400",
  },
  {
    value: "pink",
    label: "Pink",
    bgClass: "bg-pink-500",
    borderClass: "border-pink-500",
    textClass: "text-pink-500",
  },

  // Row 2: Oranges & Yellows
  {
    value: "orange-light",
    label: "Light Orange",
    bgClass: "bg-orange-400",
    borderClass: "border-orange-400",
    textClass: "text-orange-400",
  },
  {
    value: "orange",
    label: "Orange",
    bgClass: "bg-orange-500",
    borderClass: "border-orange-500",
    textClass: "text-orange-500",
  },
  {
    value: "amber",
    label: "Amber",
    bgClass: "bg-amber-500",
    borderClass: "border-amber-500",
    textClass: "text-amber-500",
  },
  {
    value: "yellow-light",
    label: "Light Yellow",
    bgClass: "bg-yellow-400",
    borderClass: "border-yellow-400",
    textClass: "text-yellow-400",
  },
  {
    value: "yellow",
    label: "Yellow",
    bgClass: "bg-yellow-500",
    borderClass: "border-yellow-500",
    textClass: "text-yellow-500",
  },
  {
    value: "lime",
    label: "Lime",
    bgClass: "bg-lime-500",
    borderClass: "border-lime-500",
    textClass: "text-lime-500",
  },

  // Row 3: Greens & Teals
  {
    value: "green-light",
    label: "Light Green",
    bgClass: "bg-green-400",
    borderClass: "border-green-400",
    textClass: "text-green-400",
  },
  {
    value: "green",
    label: "Green",
    bgClass: "bg-green-500",
    borderClass: "border-green-500",
    textClass: "text-green-500",
  },
  {
    value: "emerald",
    label: "Emerald",
    bgClass: "bg-emerald-500",
    borderClass: "border-emerald-500",
    textClass: "text-emerald-500",
  },
  {
    value: "teal",
    label: "Teal",
    bgClass: "bg-teal-500",
    borderClass: "border-teal-500",
    textClass: "text-teal-500",
  },
  {
    value: "cyan",
    label: "Cyan",
    bgClass: "bg-cyan-500",
    borderClass: "border-cyan-500",
    textClass: "text-cyan-500",
  },
  {
    value: "sky",
    label: "Sky",
    bgClass: "bg-sky-500",
    borderClass: "border-sky-500",
    textClass: "text-sky-500",
  },

  // Row 4: Blues & Purples
  {
    value: "blue-light",
    label: "Light Blue",
    bgClass: "bg-blue-400",
    borderClass: "border-blue-400",
    textClass: "text-blue-400",
  },
  {
    value: "blue",
    label: "Blue",
    bgClass: "bg-blue-500",
    borderClass: "border-blue-500",
    textClass: "text-blue-500",
  },
  {
    value: "indigo",
    label: "Indigo",
    bgClass: "bg-indigo-500",
    borderClass: "border-indigo-500",
    textClass: "text-indigo-500",
  },
  {
    value: "violet",
    label: "Violet",
    bgClass: "bg-violet-500",
    borderClass: "border-violet-500",
    textClass: "text-violet-500",
  },
  {
    value: "purple",
    label: "Purple",
    bgClass: "bg-purple-500",
    borderClass: "border-purple-500",
    textClass: "text-purple-500",
  },
  {
    value: "fuchsia",
    label: "Fuchsia",
    bgClass: "bg-fuchsia-500",
    borderClass: "border-fuchsia-500",
    textClass: "text-fuchsia-500",
  },

  // Row 5: Neutrals
  {
    value: "slate",
    label: "Slate",
    bgClass: "bg-slate-500",
    borderClass: "border-slate-500",
    textClass: "text-slate-500",
  },
  {
    value: "gray",
    label: "Gray",
    bgClass: "bg-gray-500",
    borderClass: "border-gray-500",
    textClass: "text-gray-500",
  },
  {
    value: "zinc",
    label: "Zinc",
    bgClass: "bg-zinc-500",
    borderClass: "border-zinc-500",
    textClass: "text-zinc-500",
  },
];

/**
 * Color hex values for inline styles (since we're not using Tailwind)
 */
export const COLOR_HEX_VALUES: Record<Exclude<BucketColor, null>, string> = {
  // Reds & Pinks
  "red-light": "#f87171",
  red: "#ef4444",
  "red-dark": "#b91c1c",
  rose: "#f43f5e",
  "pink-light": "#f472b6",
  pink: "#ec4899",
  // Oranges & Yellows
  "orange-light": "#fb923c",
  orange: "#f97316",
  amber: "#f59e0b",
  "yellow-light": "#facc15",
  yellow: "#eab308",
  lime: "#84cc16",
  // Greens & Teals
  "green-light": "#4ade80",
  green: "#22c55e",
  emerald: "#10b981",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  sky: "#0ea5e9",
  // Blues & Purples
  "blue-light": "#60a5fa",
  blue: "#3b82f6",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  purple: "#a855f7",
  fuchsia: "#d946ef",
  // Neutrals
  slate: "#64748b",
  gray: "#6b7280",
  zinc: "#71717a",
};

/**
 * Get color config by value
 */
export function getColorConfig(color: BucketColor): ColorConfig | undefined {
  if (!color) return undefined;
  return BUCKET_COLORS.find((c) => c.value === color);
}

/**
 * Get hex color value for inline styles
 */
export function getColorHex(color: BucketColor): string | undefined {
  if (!color) return undefined;
  return COLOR_HEX_VALUES[color];
}
