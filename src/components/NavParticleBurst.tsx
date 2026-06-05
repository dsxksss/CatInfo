import { motion } from 'framer-motion';
import { useMemo } from 'react';

/**
 * Particle-collision burst — fired across the whole active menu item the instant
 * a tab becomes active. Echoes the liveline chart's "impact" energy: sparks seeded
 * all over the item that scatter outward and fade, as if the pill slammed home.
 */

const PARTICLE_COUNT = 18;
const COLORS = ['#ffffff', '#d1fae5', '#6ee7b7', '#a7f3d0'];

interface NavParticleBurstProps {
  /** Changing this value re-mounts the burst, replaying the animation. */
  trigger: string;
}

export default function NavParticleBurst({ trigger }: NavParticleBurstProps) {
  const particles = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
      // Seed origin anywhere across the item so the spark covers the whole pill,
      // not just a single central point.
      const originX = 8 + Math.random() * 84; // % across the item width
      const originY = 15 + Math.random() * 70; // % across the item height

      // Each spark then drifts outward with a jagged zigzag kink mid-flight.
      const angle = Math.random() * Math.PI * 2;
      const distance = 10 + Math.random() * 20;
      return {
        id: i,
        originX,
        originY,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        size: 1.5 + Math.random() * 3,
        delay: Math.random() * 0.06,
        color: COLORS[i % COLORS.length],
        kink: (Math.random() - 0.5) * 12,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-visible">
      {particles.map((p) => (
        <motion.span
          key={`${trigger}-${p.id}`}
          className="absolute rounded-full"
          style={{
            left: `${p.originX}%`,
            top: `${p.originY}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 6px ${p.color}`,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            // Three-stage path: pop → zigzag kink → scatter & fade.
            x: [0, p.x * 0.55 + p.kink, p.x],
            y: [0, p.y * 0.55 - 3, p.y],
            opacity: [1, 1, 0],
            scale: [1, 1.3, 0.2],
          }}
          transition={{ duration: 0.5, delay: p.delay, ease: [0.2, 0.7, 0.3, 1] }}
        />
      ))}
    </div>
  );
}
