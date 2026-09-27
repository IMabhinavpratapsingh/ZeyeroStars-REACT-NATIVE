import { useCallback, useEffect, useRef } from 'react';

// Ek aisa function deta hai jiski identity kabhi nahi badalti, lekin har
// call par hamesha LATEST `fn` chalta hai (stale closure nahi).
export default function useStableCallback<Args extends any[], R>(fn: (...args: Args) => R): (...args: Args) => R {
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  });

  return useCallback((...args: Args) => fnRef.current(...args), []);
}