import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Tracks the OS "Reduce Motion" accessibility setting so animations can be
// disabled/instant when the user prefers it (skill: reduced-motion, CRITICAL).
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(!!v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) =>
      setReduced(!!v)
    );
    return () => {
      mounted = false;
      // RN >= 0.65 returns a subscription with remove(); guard for older shapes.
      // @ts-ignore
      sub?.remove?.();
    };
  }, []);

  return reduced;
}
