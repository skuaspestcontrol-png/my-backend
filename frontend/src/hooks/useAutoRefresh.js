import { useEffect, useRef } from 'react';

export default function useAutoRefresh(callback, options = {}) {
  const {
    enabled = true,
    intervalMs = 60000,
    runOnFocus = true,
    runOnVisible = true
  } = options;
  const callbackRef = useRef(callback);
  const runningRef = useRef(false);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;

    const run = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        await callbackRef.current?.();
      } catch (error) {
        console.error('Auto refresh failed', error);
      } finally {
        runningRef.current = false;
      }
    };

    const onFocus = () => run();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') run();
    };

    const timer = window.setInterval(run, intervalMs);
    if (runOnFocus) window.addEventListener('focus', onFocus);
    if (runOnVisible) document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(timer);
      if (runOnFocus) window.removeEventListener('focus', onFocus);
      if (runOnVisible) document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, intervalMs, runOnFocus, runOnVisible]);
}
