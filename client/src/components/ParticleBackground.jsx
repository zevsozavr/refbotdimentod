import React, { useEffect, useRef } from 'react';

const PARTICLE_COUNT = 150;
const SYMBOLS = ['$'];
const IMAGES = ['/photos/bonanza1000-removebg-preview.png', '/photos/gates1000-removebg-preview.png'];

const ParticleBackground = ({ lightweight }) => {
  const containerRef = useRef();

  useEffect(() => {
    if (lightweight) return;
    const container = containerRef.current;
    if (!container) return;

    const particles = Array.from({ length: PARTICLE_COUNT }, () => {
      const el = document.createElement('div');
      el.className = 'particle';
      const useImage = Math.random() < 0.3;
      if (useImage) {
        const img = document.createElement('img');
        img.src = IMAGES[Math.floor(Math.random() * IMAGES.length)];
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;filter:grayscale(1)brightness(0.6)';
        img.alt = '';
        el.appendChild(img);
        el.style.cssText = `
          left: ${Math.random() * 100}%;
          width: ${24 + Math.random() * 26}px;
          height: ${24 + Math.random() * 26}px;
          animation-duration: ${10 + Math.random() * 12}s;
          animation-delay: ${-Math.random() * 20}s;
          opacity: ${0.06 + Math.random() * 0.1};
        `;
      } else {
        el.textContent = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        el.style.cssText = `
          left: ${Math.random() * 100}%;
          font-size: ${18 + Math.random() * 24}px;
          animation-duration: ${8 + Math.random() * 10}s;
          animation-delay: ${-Math.random() * 16}s;
          opacity: ${0.1 + Math.random() * 0.16};
          color: rgba(200, 200, 255, 0.15);
        `;
      }
      container.appendChild(el);
      return el;
    });

    return () => particles.forEach(p => p.remove());
  }, [lightweight]);

  return <div ref={containerRef} className="particle-container" aria-hidden="true" />;
};

export default ParticleBackground;
