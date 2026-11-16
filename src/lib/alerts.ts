/* Sound, vibration and keep-awake. iPhone Safari ignores navigator.vibrate, so the rest
   timer also flashes the screen. Audio must be unlocked by a tap (we do it on Start workout). */
let ctx: AudioContext | null = null;

export function unlockAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    // a silent blip finishes the iOS unlock
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.01);
  } catch {
    /* no audio */
  }
}

export function beep(times = 3, freq = 880, len = 0.16, gap = 0.12) {
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      const s = t0 + i * (len + gap);
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.5, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + len);
      o.connect(g).connect(ctx.destination);
      o.start(s);
      o.stop(s + len + 0.02);
    }
  } catch {
    /* ignore */
  }
}

export function buzz(pattern: number | number[] = [200, 100, 200]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported on iPhone */
  }
}

type WakeLockSentinelLike = { release: () => Promise<void> };
let lock: WakeLockSentinelLike | null = null;
export async function keepAwake(on: boolean) {
  const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock;
  try {
    if (on && wl && !lock) lock = await wl.request('screen');
    if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch {
    lock = null;
  }
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && lock) {
      lock = null;
      void keepAwake(true);
    }
  });
}
