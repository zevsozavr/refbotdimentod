import React, { useEffect, useRef } from 'react';

const PARTICLE_COUNT = 150;
const SYMBOLS = ['♠','♣','♥','♦','★','☆','✦','✧','◆','◇','▲','△','●','○','■','□','※','⁂','✿','❀','⚜','✤','✥'];

const ParticleBackground = ({ lightweight }) => {
  const containerRef = useRef();

  useEffect(() => {
    if (lightweight) return;
    const container = containerRef.current;
    if (!container) return;

    const particles = Array.from({ length: PARTICLE_COUNT }, () => {
      const el = document.createElement('div');
      el.className = 'particle';
      el.textContent = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      el.style.cssText = `
        left: ${Math.random() * 100}%;
        font-size: ${18 + Math.random() * 24}px;
        animation-duration: ${8 + Math.random() * 10}s;
        animation-delay: ${-Math.random() * 16}s;
        opacity: ${0.1 + Math.random() * 0.16};
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
