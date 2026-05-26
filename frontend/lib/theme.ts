export const colors = {
  background: '#0a2f1f',
  card: '#0d3d28',
  accent: '#00ff88',
  border: 'rgba(0, 255, 136, 0.3)',
  text: '#ffffff',
  textMuted: '#9ca3af',
  error: '#ef4444',

  // Complementary semantic accents — used for state/meaning, never decoration.
  // Neon green (`accent`) stays the brand hero; these support it.
  secondary: '#22d3ee',   // cyan/teal — secondary actions, neutral highlights
  pending: '#f59e0b',     // amber — pending / awaiting state
  info: '#3b82f6',        // blue — completed / informational
  win: '#00ff88',         // success / win (mirrors accent)
  loss: '#ef4444',        // loss / danger (mirrors error)

  // Soft tints (12% fills) for chips, banners, pressed surfaces
  accentSoft: 'rgba(0, 255, 136, 0.12)',
  secondarySoft: 'rgba(34, 211, 238, 0.12)',
  pendingSoft: 'rgba(245, 158, 11, 0.12)',
  infoSoft: 'rgba(59, 130, 246, 0.12)',
  lossSoft: 'rgba(239, 68, 68, 0.12)',

  // Glow used for elevation/emphasis on the neon brand
  glow: '#00ff88',
};

// Motion tokens — keep every animation on the same rhythm (skill: motion-consistency).
export const motion = {
  fast: 120,
  base: 220,
  slow: 320,
  stagger: 60, // per-item entrance delay for lists/grids
};

// Reusable neon glow shadow (iOS shadow + Android elevation).
export const glow = (color: string = colors.glow, intensity: number = 0.45) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: intensity,
  shadowRadius: 12,
  elevation: 6,
});
