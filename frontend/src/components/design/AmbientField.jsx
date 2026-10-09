import { useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/material';

/**
 * Decorative, interactive ambient layer shared by public and app shells.
 * It remains pointer-transparent to the actual UI but subtly follows the
 * pointer so the product never feels like a static template.
 */
export default function AmbientField({ compact = false }) {
  const nodes = useMemo(() => [
    { left: '8%', top: '12%', size: compact ? 180 : 260, delay: '0s', tone: 'violet', depth: 0.7 },
    { left: '78%', top: '7%', size: compact ? 210 : 320, delay: '-2.2s', tone: 'orange', depth: 1 },
    { left: '62%', top: '72%', size: compact ? 160 : 250, delay: '-4.2s', tone: 'cyan', depth: 0.55 },
  ], [compact]);

  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let frame = 0;
    const onMove = (event) => {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      const x = ((event.clientX / Math.max(1, window.innerWidth)) - 0.5) * 18;
      const y = ((event.clientY / Math.max(1, window.innerHeight)) - 0.5) * 14;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setOffset({ x, y }));
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('pointermove', onMove); };
  }, []);

  return (
    <Box className="ambient-field" aria-hidden="true" sx={{ '--ambient-x': `${offset.x}px`, '--ambient-y': `${offset.y}px` }}>
      <div className="ambient-grid-lines" />
      {nodes.map((node, i) => (
        <span
          key={i}
          className={`ambient-blob ambient-${node.tone}`}
          style={{
            left: node.left,
            top: node.top,
            width: node.size,
            height: node.size,
            animationDelay: node.delay,
            transform: `translate3d(${offset.x * node.depth}px, ${offset.y * node.depth}px, 0)`,
          }}
        />
      ))}
      <span className="ambient-ring ambient-ring-one" />
      <span className="ambient-ring ambient-ring-two" />
      <span className="ambient-sheen" />
    </Box>
  );
}
