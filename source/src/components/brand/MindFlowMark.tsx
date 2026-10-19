import React from 'react';

interface MindFlowMarkProps {
  className?: string;
}

/** Fluid Origami Wing (流体折纸旋翼) - Official MindFlow Brand Mark */
export const MindFlowMark: React.FC<MindFlowMarkProps> = ({ className = '' }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 64 64"
    fill="none"
    className={className}
  >
    <defs>
      <linearGradient id="mfBrandWing1" x1="12" y1="16" x2="52" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#06B6D4" />
        <stop offset="100%" stopColor="#3B82F6" />
      </linearGradient>
      <linearGradient id="mfBrandWing2" x1="10" y1="30" x2="54" y2="38" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6366F1" />
        <stop offset="100%" stopColor="#A855F7" />
      </linearGradient>
      <linearGradient id="mfBrandWing3" x1="16" y1="44" x2="48" y2="52" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#EC4899" />
        <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.3" />
      </linearGradient>
    </defs>

    {/* 底层流翼：柔和托底 */}
    <path
      d="M 14 44 C 24 42, 34 46, 50 42 C 42 50, 30 56, 14 44 Z"
      fill="url(#mfBrandWing3)"
    />

    {/* 中层流翼：主视觉承转，优雅的双曲率叶面 */}
    <path
      d="M 8 30 C 24 24, 38 34, 56 26 C 46 38, 28 44, 8 30 Z"
      fill="url(#mfBrandWing2)"
    />
    <path
      d="M 8 30 C 28 44, 46 38, 56 26"
      stroke="#FFFFFF"
      strokeWidth={1}
      strokeLinecap="round"
      opacity={0.5}
    />

    {/* 顶层流翼：向右上破界扬起 */}
    <path
      d="M 14 18 C 28 10, 40 20, 54 10 C 46 24, 30 30, 14 18 Z"
      fill="url(#mfBrandWing1)"
    />
    <path
      d="M 14 18 C 30 30, 46 24, 54 10"
      stroke="#FFFFFF"
      strokeWidth={1.2}
      strokeLinecap="round"
      opacity={0.75}
    />
  </svg>
);
