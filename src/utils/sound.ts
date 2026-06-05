/**
 * Tiny synthesized UI sound effects via the Web Audio API — no audio assets
 * needed. playJellyPop() is a short, soft "boop" tuned to match the jelly
 * bounce of the sidebar menu items.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  // Browsers suspend the context until a user gesture; resume on demand.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function playJellyPop() {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  // Main body — a round sine that drops in pitch for a bouncy "boop".
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(540, now);
  osc.frequency.exponentialRampToValueAtTime(300, now + 0.13);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.24);

  // Crisp high tick layered on top for a snappy jelly "snap".
  const tick = ac.createOscillator();
  const tickGain = ac.createGain();
  tick.type = 'triangle';
  tick.frequency.setValueAtTime(1180, now);
  tick.frequency.exponentialRampToValueAtTime(760, now + 0.05);
  tickGain.gain.setValueAtTime(0.0001, now);
  tickGain.gain.exponentialRampToValueAtTime(0.05, now + 0.008);
  tickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  tick.connect(tickGain).connect(ac.destination);
  tick.start(now);
  tick.stop(now + 0.09);
}
