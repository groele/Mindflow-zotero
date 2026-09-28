import React from 'react';

interface MindFlowMarkProps {
  className?: string;
}

/** 02. MapGraph (星轨拓扑) - Scalable MindFlow brand identity mark with refined optical padding. */
export const MindFlowMark: React.FC<MindFlowMarkProps> = ({ className = '' }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 32 32"
    fill="none"
    className={className}
  >
    <defs>
      <linearGradient id="mfMarkCenter" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0284C7" />
        <stop offset="100%" stopColor="#0369A1" />
      </linearGradient>
    </defs>
    <g stroke="#0284C7" strokeWidth="1.6" strokeLinecap="round" opacity="0.85">
      <line x1="16" y1="16" x2="16" y2="7.2" />
      <line x1="16" y1="16" x2="21.7" y2="10.3" />
      <line x1="16" y1="16" x2="24.8" y2="16" />
      <line x1="16" y1="16" x2="21.7" y2="21.7" />
      <line x1="16" y1="16" x2="16" y2="24.8" />
      <line x1="16" y1="16" x2="10.3" y2="21.7" />
      <line x1="16" y1="16" x2="7.2" y2="16" />
      <line x1="16" y1="16" x2="10.3" y2="10.3" />
    </g>
    <circle cx="16" cy="7.2" r="1.9" fill="#0284C7" stroke="#FFFFFF" strokeWidth="0.5" />
    <circle cx="21.7" cy="10.3" r="1.6" fill="#06B6D4" stroke="#FFFFFF" strokeWidth="0.5" />
    <circle cx="24.8" cy="16" r="1.9" fill="#0EA5E9" stroke="#FFFFFF" strokeWidth="0.5" />
    <circle cx="21.7" cy="21.7" r="1.6" fill="#6366F1" stroke="#FFFFFF" strokeWidth="0.5" />
    <circle cx="16" cy="24.8" r="1.9" fill="#0284C7" stroke="#FFFFFF" strokeWidth="0.5" />
    <circle cx="10.3" cy="21.7" r="1.6" fill="#8B5CF6" stroke="#FFFFFF" strokeWidth="0.5" />
    <circle cx="7.2" cy="16" r="1.9" fill="#0EA5E9" stroke="#FFFFFF" strokeWidth="0.5" />
    <circle cx="10.3" cy="10.3" r="1.6" fill="#06B6D4" stroke="#FFFFFF" strokeWidth="0.5" />
    <circle cx="16" cy="16" r="4.0" fill="url(#mfMarkCenter)" stroke="#FFFFFF" strokeWidth="0.75" />
    <g stroke="#FFFFFF" strokeWidth="0.85" strokeLinecap="round">
      <line x1="14.8" y1="17.2" x2="16" y2="16" />
      <line x1="16" y1="16" x2="17.2" y2="14.8" />
    </g>
    <circle cx="14.8" cy="17.2" r="0.7" fill="#FFFFFF" />
    <circle cx="16" cy="16" r="0.9" fill="#FFFFFF" />
    <circle cx="17.2" cy="14.8" r="0.7" fill="#FFFFFF" />
  </svg>
);
