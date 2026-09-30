/** @type {import('tailwindcss').Config} */
// Theme values point at the CSS tokens in src/styles/app.css, so Tailwind
// utilities and the component classes share one palette (light + dark).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)', surface: 'var(--surface)', surface2: 'var(--surface2)',
        ink: 'var(--ink)', muted: 'var(--muted)', faint: 'var(--faint)', line: 'var(--line)',
        primary: 'var(--primary)', 'primary-soft': 'var(--primary-soft)',
        accent: 'var(--accent)', 'accent-soft': 'var(--accent-soft)',
        ok: 'var(--ok)', bad: 'var(--bad)', warn: 'var(--warn)',
        'org-p': 'var(--org-p)', 'org-v': 'var(--org-v)', 'org-l': 'var(--org-l)',
      },
      fontFamily: {
        display: ['Sora', 'Segoe UI', 'system-ui', 'sans-serif'],
        body: ['Figtree', 'Noto Sans Devanagari', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
