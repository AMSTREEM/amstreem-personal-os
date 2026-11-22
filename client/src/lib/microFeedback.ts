const FEEDBACK_KEY = 'atlas-sound-feedback';
let audioContext: AudioContext | null = null;
let lastCheckAt=0,comboStep=0;
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
    const nowMs=Date.now();
    if(kind==='tick'){comboStep=nowMs-lastCheckAt<=8000?Math.min(3,comboStep+1):1;lastCheckAt=nowMs;}
    else {comboStep=0;lastCheckAt=0;}
    if (localStorage.getItem(FEEDBACK_KEY) !== 'on') return;
    const context = contextForFeedback();
    if (!context) return;
    const now = context.currentTime;
    const tone = (frequency: number, offset: number, duration: number, peak: number) => {
      const oscillator = context.createOscillator(), gain = context.createGain(), start = now + offset;
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start); gain.gain.linearRampToValueAtTime(peak, start + Math.min(0.003, duration / 4));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(start); oscillator.stop(start + duration + 0.002);
    };
    if (kind === 'tick') { const notes=[523.25,659.25,783.99]; tone(notes[Math.max(0,comboStep-1)],0,0.075,0.006); }
    else { tone(660, 0, 0.18, 0.009); tone(880, 0.055, 0.22, 0.006); }
  } catch { /* Unsupported audio and autoplay restrictions fail silently. */ }
}
