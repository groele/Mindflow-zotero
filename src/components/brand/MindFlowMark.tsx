import React from 'react';

interface MindFlowMarkProps {
  className?: string;
}

/** 02. MapGraph (星轨拓扑) - Scalable MindFlow brand identity mark. */
export const MindFlowMark: React.FC<MindFlowMarkProps> = ({ className = '' }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 32 32"
    fill="none"
    className={className}
  >
    <defs>
      <linearGradient id="mfMarkBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#F1F5F9" />
      </linearGradient>
      <linearGradient id="mfMarkCenter" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0284C7" />
        <stop offset="100%" stopColor="#0369A1" />
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="30" height="30" rx="7.5" fill="url(#mfMarkBg)" stroke="#CBD5E1" strokeWidth="0.8" />
    <g stroke="#0284C7" strokeWidth="1.6" strokeLinecap="round" opacity="0.85">
      <line x1="16" y1="16" x2="16" y2="5.8" />
      <line x1="16" y1="16" x2="22.8" y2="9.2" />
      <line x1="16" y1="16" x2="26.2" y2="16" />
      <line x1="16" y1="16" x2="22.8" y2="22.8" />
      <line x1="16" y1="16" x2="16" y2="26.2" />
      <line x1="16" y1="16" x2="9.2" y2="22.8" />
      <line x1="16" y1="16" x2="5.8" y2="16" />
      <line x1="16" y1="16" x2="9.2" y2="9.2" />
    </g>
    <circle cx="16" cy="5.8" r="2.1" fill="#0284C7" stroke="#FFFFFF" strokeWidth="0.6" />
    <circle cx="22.8" cy="9.2" r="1.8" fill="#06B6D4" stroke="#FFFFFF" strokeWidth="0.6" />
    <circle cx="26.2" cy="16" r="2.1" fill="#0EA5E9" stroke="#FFFFFF" strokeWidth="0.6" />
    <circle cx="22.8" cy="22.8" r="1.8" fill="#6366F1" stroke="#FFFFFF" strokeWidth="0.6" />
    <circle cx="16" cy="26.2" r="2.1" fill="#0284C7" stroke="#FFFFFF" strokeWidth="0.6" />
    <circle cx="9.2" cy="22.8" r="1.8" fill="#8B5CF6" stroke="#FFFFFF" strokeWidth="0.6" />
    <circle cx="5.8" cy="16" r="2.1" fill="#0EA5E9" stroke="#FFFFFF" strokeWidth="0.6" />
    <circle cx="9.2" cy="9.2" r="1.8" fill="#06B6D4" stroke="#FFFFFF" strokeWidth="0.6" />
    <circle cx="16" cy="16" r="4.3" fill="url(#mfMarkCenter)" stroke="#FFFFFF" strokeWidth="0.8" />
    <g stroke="#FFFFFF" strokeWidth="0.9" strokeLinecap="round">
      <line x1="14.7" y1="17.3" x2="16" y2="16" />
      <line x1="16" y1="16" x2="17.3" y2="14.7" />
    </g>
    <circle cx="14.7" cy="17.3" r="0.75" fill="#FFFFFF" />
    <circle cx="16" cy="16" r="1.0" fill="#FFFFFF" />
    <circle cx="17.3" cy="14.7" r="0.75" fill="#FFFFFF" />
  </svg>
);
