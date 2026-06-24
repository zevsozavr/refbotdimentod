import { useState, useEffect } from 'react';

const useCountUp = (target, duration = 1000) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === 0) return;
    const start = performance.now();
    let rafId;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target]);

  return value;
};

export default useCountUp;
