import React from 'react';

interface MindFlowMarkProps {
  className?: string;
}

/** Quiet, scalable MindFlow identity mark shared with the extension icon artwork. */
export const MindFlowMark: React.FC<MindFlowMarkProps> = ({ className = '' }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 32 32"
    fill="none"
    className={className}
  >
    <rect x="1" y="1" width="30" height="30" rx="8" fill="#EFF4F7" />
    <g stroke="#697F8E" strokeWidth="2" strokeLinecap="round">
      <path d="M14 14 8.8 8.8M14 18l-5.2 5.2M18 14l5.2-5.2M18 18l5.2 5.2" />
    </g>
    <g fill="#FAFCFD" stroke="#526F82" strokeWidth="1.5">
      <circle cx="7.3" cy="7.3" r="2.6" />
      <circle cx="7.3" cy="24.7" r="2.6" />
      <circle cx="24.7" cy="7.3" r="2.6" />
      <circle cx="24.7" cy="24.7" r="2.6" />
    </g>
    <circle cx="16" cy="16" r="4.2" fill="#526F82" />
  </svg>
);
