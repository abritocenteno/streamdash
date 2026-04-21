// ─── Obsidian Aviator Design System ────────────────────────────────────────
// Creative North Star: "The Obsidian Aviator"
// A high-performance cockpit interface — split-second legibility, zero distraction.
// Organic Brutalism: raw structural power of instrumentation + layered glass depth.

export const Colors = {
  // ── Background / Surface Hierarchy ────────────────────────────────────────
  background:                "#111318",  // void / floor
  surfaceContainerLowest:    "#0c0e12",  // deepest layer (camera feed bg)
  surfaceContainerLow:       "#1a1c20",  // card floor
  surfaceContainer:          "#1e2024",  // default container
  surfaceContainerHigh:      "#282a2e",  // elevated cards, interactive panels
  surfaceContainerHighest:   "#333539",  // floating panels (must-touch while driving)
  surfaceBright:             "#37393e",  // active/hovered surface

  // ── Text ───────────────────────────────────────────────────────────────────
  onSurface:                 "#e2e2e8",  // primary text — NOT pure white (prevents night-blindness)
  onSurfaceVariant:          "#bac9cc",  // secondary text
  outline:                   "#849396",  // muted / placeholder
  outlineVariant:            "#3b494c",  // ghost borders, dividers (avoid overuse)

  // ── Primary — The "Record" Red ─────────────────────────────────────────────
  // Use for: record button, streaming state, critical alerts, primary CTAs
  primary:                   "#ffe7e6",
  primaryFixed:              "#ffdad9",
  primaryFixedDim:           "#ffb3b2",
  primaryContainer:          "#ffc1c0",
  onPrimary:                 "#680013",
  onPrimaryContainer:        "#b50028",  // gradient start
  inversePrimary:            "#bf002b",  // gradient end / brand red
  recordRedDim:              "rgba(191,0,43,0.15)",

  // ── Secondary — Electric Purple (stream/connectivity) ──────────────────────
  secondary:                 "#d1bcff",
  secondaryFixed:            "#e9ddff",
  secondaryFixedDim:         "#d1bcff",
  secondaryContainer:        "#7000ff",
  onSecondary:               "#3c0090",
  onSecondaryContainer:      "#ddcdff",
  onSecondaryFixed:          "#23005b",
  onSecondaryFixedVariant:   "#5700c9",

  // ── Tertiary — The "Streaming" Electric Cyan ───────────────────────────────
  // Use for: GPS data, active selections, data streams, connectivity indicators
  tertiary:                  "#c3f5ff",
  tertiaryFixed:             "#9cf0ff",
  tertiaryFixedDim:          "#00daf3",
  tertiaryContainer:         "#00e5ff",  // electric cyan
  onTertiary:                "#00363d",
  onTertiaryContainer:       "#00626e",
  onTertiaryFixed:           "#001f24",
  onTertiaryFixedVariant:    "#004f58",
  electricCyanDim:           "rgba(0,229,255,0.12)",

  // ── Error ──────────────────────────────────────────────────────────────────
  error:                     "#ffb4ab",
  errorContainer:            "#93000a",
  onError:                   "#690005",
  onErrorContainer:          "#ffdad6",

  // ── Inverse ────────────────────────────────────────────────────────────────
  inverseOnSurface:          "#2f3035",
  inverseSurface:            "#e2e2e8",

  // ── Glass Panel ────────────────────────────────────────────────────────────
  // surfaceBright @ 40% opacity — simulates glassmorphism in RN (no backdrop-filter)
  glassBg:                   "rgba(55,57,62,0.4)",
  glassBorder:               "rgba(59,73,76,0.3)",  // outlineVariant @ 30%

  // ── Semantic Aliases (for ergonomic use across screens) ────────────────────
  // These preserve backward-compatibility with existing Color refs
  // while mapping to the new design vocabulary.

  neonGreen:     "#00e5ff",              // → electric cyan (data/active accent)
  neonGreenDim:  "rgba(0,229,255,0.12)", // → electricCyanDim
  red:           "#bf002b",              // → record red
  redDim:        "rgba(191,0,43,0.15)",  // → recordRedDim
  white:         "#e2e2e8",              // → onSurface (NOT pure white)
  whiteDim:      "rgba(226,226,232,0.7)",
  textMuted:     "#849396",              // → outline
  border:        "#3b494c",              // → outlineVariant
  surface:       "rgba(40,42,46,0.85)",  // glass panel (surfaceContainerHigh + alpha)
  surfaceLight:  "#282a2e",              // → surfaceContainerHigh
};

// ─── Typography ────────────────────────────────────────────────────────────
// Space Grotesk = "Instrumentation" typeface — wide, aggressive, HUD-legible
// Manrope       = "Information" typeface — clean, geometric, readable at rest
export const Typography = {
  // Space Grotesk — for all numeric data, HUD labels, headlines, CTAs
  headline:        "SpaceGrotesk_700Bold"    as const,
  headlineSemi:    "SpaceGrotesk_600SemiBold" as const,
  headlineMedium:  "SpaceGrotesk_500Medium"  as const,
  headlineRegular: "SpaceGrotesk_400Regular" as const,

  // Manrope — for settings, logs, body copy, secondary metadata
  body:            "Manrope_400Regular"      as const,
  bodyMedium:      "Manrope_500Medium"       as const,
  bodySemiBold:    "Manrope_600SemiBold"     as const,
  bodyBold:        "Manrope_700Bold"         as const,

  // Legacy alias kept for any reference not yet migrated
  mono:            "SpaceGrotesk_700Bold"    as const,
};

// ─── Border Radius Scale ───────────────────────────────────────────────────
export const Radius = {
  sm:   2,    // micro-indicators, "LIVE" tags
  lg:   8,    // standard data cards
  xl:   12,   // map PiP, video feed containers
  full: 9999, // primary action triggers — the "Big Red Button"
};

// ─── Elevation / Shadow ────────────────────────────────────────────────────
// Ambient cockpit-lighting shadows — NOT generic Material shadows
export const Shadow = {
  hud: {
    shadowColor: "#5700c9",  // onSecondaryFixedVariant tint
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 8,
  },
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
};

// ─── Stream Config (business logic — unchanged) ────────────────────────────
export const StreamConfig = {
  GPS_POLL_MS: 2000,
  GPS_TRAIL_MAX: 20,
  GPS_LOG_MAX: 500,
};

export const StreamPlatforms = {
  youtube: {
    label: "YouTube",
    rtmpBase: "rtmps://a.rtmp.youtube.com:443/live2/",
    keyPlaceholder: "xxxx-xxxx-xxxx-xxxx-xxxx",
    keyLabel: "STREAM KEY",
    keyHint: "YouTube Studio › Go Live › Stream settings",
  },
  twitch: {
    label: "Twitch",
    rtmpBase: "rtmp://live.twitch.tv/app/",
    keyPlaceholder: "live_XXXXXXXXXXXXXXXXXXXXXXXXXX",
    keyLabel: "STREAM KEY",
    keyHint: "Twitch Dashboard › Settings › Stream",
  },
  facebook: {
    label: "Facebook",
    rtmpBase: "rtmps://live-api-s.facebook.com:443/rtmp/",
    keyPlaceholder: "FB-XXXXXXXXXXXXXXXXXX-XXXX",
    keyLabel: "STREAM KEY",
    keyHint: "Facebook › Live Producer › Use stream key",
  },
  custom: {
    label: "Custom RTMP",
    rtmpBase: "",
    keyPlaceholder: "rtmp://your-server/live/stream-key",
    keyLabel: "FULL RTMP URL",
    keyHint: "Enter the complete RTMP stream URL including the key",
  },
} as const;

export type StreamPlatform = keyof typeof StreamPlatforms;

export function buildStreamUrl(platform: StreamPlatform | string, key: string): string {
  const p = StreamPlatforms[platform as StreamPlatform];
  if (!p) return `${StreamPlatforms.youtube.rtmpBase}${key}`;
  if (platform === "custom") return key;
  return `${p.rtmpBase}${key}`;
}

export const ResolutionPresets: Record<
  string,
  { width: number; height: number; bitrate: number }
> = {
  "480p": { width: 854,  height: 480,  bitrate: 1000 * 1000 },
  "720p": { width: 1280, height: 720,  bitrate: 2000 * 1000 },
  "1080p":{ width: 1920, height: 1080, bitrate: 4500 * 1000 },
};
