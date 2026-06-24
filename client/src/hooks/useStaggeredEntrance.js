import { useEffect } from 'react';

const useStaggeredEntrance = (selector, delay = 80) => {
  useEffect(() => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      setTimeout(() => {
        el.style.transition = 'opacity 400ms ease, transform 400ms ease';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, i * delay);
    });
  }, []);
};

export default useStaggeredEntrance;
