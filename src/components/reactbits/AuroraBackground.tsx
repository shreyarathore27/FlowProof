import type { ReactNode } from 'react';

export function AuroraBackground({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[var(--bg)] text-[var(--ink)]">
      {/* Background cyber grid */}
      <div 
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.035] dark:opacity-[0.06]"
        style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 10%, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 10%, black 40%, transparent 100%)',
        }}
      />

      {/* Ambient gradient meshes */}
      <div className="pointer-events-none fixed -top-[200px] left-1/2 -z-0 h-[650px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.14),transparent_65%)] blur-[100px] dark:bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.08),transparent_65%)]" />
      <div className="pointer-events-none fixed top-[20%] right-[-150px] -z-0 h-[500px] w-[500px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(167,139,250,0.12),transparent_60%)] blur-[90px] dark:bg-[radial-gradient(ellipse_at_center,rgba(167,139,250,0.06),transparent_60%)]" />
      <div className="pointer-events-none fixed bottom-[10%] left-[-150px] -z-0 h-[550px] w-[550px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.10),transparent_65%)] blur-[100px] dark:bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.05),transparent_65%)]" />

      {/* Main app content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
