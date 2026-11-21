const FEEDBACK_KEY = 'atlas-sound-feedback';
let audioContext: AudioContext | null = null;
function contextForFeedback(): AudioContext | null {
  try {
    if (!window.AudioContext) return null;
    if (!audioContext || audioContext.state === 'closed') audioContext = new window.AudioContext();
    if (audioContext.state === 'suspended') void audioContext.resume().catch(() => undefined);
    return audioContext;
  } catch { return null; }
}
export function primeAtlasAudio(): void {
  try { if (localStorage.getItem(FEEDBACK_KEY) === 'on') void contextForFeedback(); } catch { /* Optional audio never blocks Atlas. */ }
}
export function playAtlasFeedback(kind: 'tick' | 'complete'): void {
  try {
    if (localStorage.getItem(FEEDBACK_KEY) !== 'on') return;
    const context = contextForFeedback();
    if (!context) return;
    const now = context.currentTime;
    const tone = (frequency: number, offset: number, duration: number, peak: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + offset;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(peak, start + Math.min(0.003, duration / 4));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(start); oscillator.stop(start + duration + 0.002);
    };
    if (kind === 'tick') tone(1480, 0, 0.015, 0.006);
    else { tone(660, 0, 0.18, 0.009); tone(880, 0.055, 0.22, 0.006); }
  } catch { /* Unsupported audio and autoplay restrictions fail silently. */ }
}
