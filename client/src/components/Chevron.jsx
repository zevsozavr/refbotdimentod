import React from 'react';

// Crisp chevron icon for back buttons and pagination, replacing the heavy
// emoji triangle glyphs (◀ ▶) for a cleaner, consistent look. Uses
// currentColor so it inherits the button's text color.
const Chevron = ({ dir = 'left', size = 16, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ verticalAlign: 'middle', display: 'inline-block', ...style }}
  >
    {dir === 'left'
      ? <polyline points="15 18 9 12 15 6" />
      : <polyline points="9 18 15 12 9 6" />}
  </svg>
);

export default Chevron;
