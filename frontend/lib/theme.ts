// ─────────────────────────────────────────────────────────────────────────────
// RIVAL DESIGN SYSTEM
// Brand identity stays: deep forest-green canvas + neon-green hero accent.
// Elevated to a Notion/Figma level of craft — layered surfaces, a disciplined
// neutral ramp, hairline borders, a complementary violet accent used sparingly
// for "premium" moments (prize pools, streaks), and proper type/space/radius
// tokens so every screen shares one rhythm.
//
// NOTE: all legacy keys are preserved (card, error, glow, soft tints…) so older
// references keep working; new tokens are added alongside.
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
  // ── Canvas (layered greens, darkest → for gradient depth) ──
  background: '#06231a',        // deepest — base of the screen gradient
  backgroundElevated: '#0a2f1f',// brand green — headers, tab bar, fallbacks

  // ── Surfaces (elevation tiers; higher = lighter/closer) ──
  surface: '#0e3826',           // base card  (alias: card)
  surfaceHigh: '#134632',       // elevated / pressed / featured card
  surfaceMuted: '#0a2c1e',      // recessed wells: inputs, progress tracks
  card: '#0e3826',              // legacy alias → surface

  // ── Borders (soft neutral-green hairlines, Notion-style restraint) ──
  border: 'rgba(143, 227, 184, 0.13)',
  borderStrong: 'rgba(0, 255, 136, 0.45)',
  hairline: 'rgba(143, 227, 184, 0.08)',

  // ── Brand + accents ──
  accent: '#00ff88',            // hero neon green — primary CTA, "you", win
  accentDim: '#04c873',         // pressed/secondary tone of brand
  secondary: '#a78bfa',         // VIOLET — complementary premium highlight
  secondaryDim: '#8b6df0',
  cyan: '#22d3ee',              // neutral highlight / links

  // ── Text (greenish neutral ramp, all AA on dark surfaces) ──
  text: '#f3fbf7',
  textSecondary: '#a9cebb',     // ≥3:1 — labels, secondary copy
  textMuted: '#709985',         // muted gray-green
  textFaint: '#5d8270',

  // ── Semantic state ──
  pending: '#fbbf24',           // amber  — awaiting
  info: '#38bdf8',              // sky    — informational / completed neutral
  win: '#00ff88',               // success
  loss: '#f87171',              // softer red — loss / danger (friendlier)
  error: '#f87171',

  // ── Soft tints (12% fills) for chips, banners, pressed surfaces ──
  accentSoft: 'rgba(0, 255, 136, 0.12)',
  secondarySoft: 'rgba(167, 139, 250, 0.14)',
  cyanSoft: 'rgba(34, 211, 238, 0.12)',
  pendingSoft: 'rgba(251, 191, 36, 0.14)',
  infoSoft: 'rgba(56, 189, 248, 0.13)',
  lossSoft: 'rgba(248, 113, 113, 0.14)',

  // Glow color used by glow() below
  glow: '#00ff88',
};

// ── Gradient stop sets (consumed by <Gradient/>) ──────────────────────────────
export const gradients = {
  // Full-screen canvas: subtle top-down deepening for depth.
  screen: ['#0b3322', '#072619', '#052015'] as string[],
  // Hero balance / prize surfaces.
  brand: ['#0c4a30', '#0e3826'] as string[],
  // Premium / prize accent wash (violet → green).
  prize: ['#2a1f4d', '#103a2a'] as string[],
  // Primary CTA button.
  cta: ['#00ff88', '#04c873'] as string[],
  // Win / loss banners.
  win: ['#0c5a38', '#0e3826'] as string[],
  loss: ['#5a2230', '#0e3826'] as string[],
};

// ── Type scale (Inter-ish system stack; weights reinforce hierarchy) ──────────
export const type = {
  display: { fontSize: 40, fontWeight: '800' as const, letterSpacing: -0.5 },
  h1:      { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.4 },
  h2:      { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3:      { fontSize: 18, fontWeight: '700' as const },
  body:    { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
  callout: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  label:   { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  // All-caps eyebrow used for section/eyebrow labels.
  overline: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 },
};

// ── Spacing (8pt rhythm, with a 4 step) ───────────────────────────────────────
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

// ── Corner radii ──────────────────────────────────────────────────────────────
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

// ── Motion tokens — keep every animation on the same rhythm ───────────────────
export const motion = {
  fast: 120,
  base: 220,
  slow: 320,
  stagger: 60, // per-item entrance delay for lists/grids
};

// ── Reusable neon glow (iOS shadow + Android elevation) ───────────────────────
export const glow = (color: string = colors.glow, intensity: number = 0.45) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: intensity,
  shadowRadius: 14,
  elevation: 6,
});

// ── Soft dark elevation (Notion-style card lift, no color cast) ───────────────
export const elevation = (level: 1 | 2 | 3 = 1) => {
  const map = {
    1: { radius: 8, y: 2, opacity: 0.18, e: 2 },
    2: { radius: 16, y: 6, opacity: 0.24, e: 6 },
    3: { radius: 28, y: 12, opacity: 0.3, e: 12 },
  }[level];
  return {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: map.y },
    shadowOpacity: map.opacity,
    shadowRadius: map.radius,
    elevation: map.e,
  };
};
