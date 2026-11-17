import React from 'react';

export type PageShellWidth = 'standard' | 'wide';

interface PageShellProps {
  /** Page content rendered inside the unified container. */
  children: React.ReactNode;
  /** Container max-width preset: 'standard' (max-w-7xl) or 'wide' (max-w-[1600px]). */
  width?: PageShellWidth;
  /** Optional extra classes for custom spacing or alignment overrides. */
  className?: string;
}

const WIDTH_CLASSES: Record<PageShellWidth, string> = {
  standard: 'w-full',
  wide: 'w-full',
};

/**
 * Shared outer page container enforcing full-width layout,
 * responsive padding, and vertical rhythm across all web console views.
 */
export const PageShell: React.FC<PageShellProps> = ({
  children,
  width = 'standard',
  className = '',
}) => {
  return (
    <div
      className={`${WIDTH_CLASSES[width]} p-3.5 sm:p-5 space-y-4 sm:space-y-5 ${className}`.trim()}
    >
      {children}
    </div>
  );
};
