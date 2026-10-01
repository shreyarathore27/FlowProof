import type { ReactNode } from 'react';

interface ShinyTextProps {
  children: ReactNode;
  className?: string;
  shimmerWidth?: number;
  speed?: number;
}

export function ShinyText({
  children,
  className = '',
  shimmerWidth = 100,
  speed = 3,
}: ShinyTextProps) {
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(120deg, rgba(255, 255, 255, 0) 40%, rgba(255, 255, 255, 0.8) 50%, rgba(255, 255, 255, 0) 60%)`,
        backgroundSize: `${shimmerWidth * 2}% 100%`,
        WebkitBackgroundClip: 'text',
        animation: `shimmer ${speed}s infinite linear`,
      }}
      className={`inline-block text-transparent bg-clip-text font-semibold ${className}`}
    >
      {children}
    </span>
  );
}
