import React, { useEffect, useRef } from 'react';

const PARTICLE_COUNT = 25;
const PREFIXES = ['particle-shape-1', 'particle-shape-2', 'particle-shape-3',
  'particle-shape-4', 'particle-shape-5', 'particle-shape-6',
  'particle-shape-7', 'particle-shape-8'];

const ParticleBackground = ({ lightweight }) => {
  const containerRef = useRef();

  useEffect(() => {
    if (lightweight) return;
    const container = containerRef.current;
    if (!container) return;

    const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const cls = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
      const el = document.createElement('div');
      el.className = `particle ${cls}`;
      el.style.cssText = `
        left: ${Math.random() * 100}%;
        font-size: ${8 + Math.random() * 14}px;
        animation-duration: ${10 + Math.random() * 15}s;
        animation-delay: ${-Math.random() * 20}s;
        opacity: ${0.06 + Math.random() * 0.12};
        color: rgba(200, 200, 255, 0.15);
      `;
      container.appendChild(el);
      return el;
    });

    return () => particles.forEach(p => p.remove());
  }, [lightweight]);

  return <div ref={containerRef} className="particle-container" aria-hidden="true" />;
};

export default ParticleBackground;
