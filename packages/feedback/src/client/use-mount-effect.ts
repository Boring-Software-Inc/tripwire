import { useEffect, type EffectCallback } from 'react';

// eslint-disable-next-line react-hooks/exhaustive-deps
export const useMountEffect = (effect: EffectCallback) => useEffect(effect, []);
