// Web Audio API synthesized audio alerts for barcode scanner & dispatch actions
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Pleasant double-chime for verified book dispatch
 */
export function playSuccessChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sine';
  osc2.type = 'triangle';

  // Pitch progression: E5 (659Hz) -> A5 (880Hz)
  osc1.frequency.setValueAtTime(659.25, now);
  osc1.frequency.setValueAtTime(880, now + 0.08);

  osc2.frequency.setValueAtTime(1318.5, now + 0.08);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now + 0.08);
  osc1.stop(now + 0.3);
  osc2.stop(now + 0.3);
}

/**
 * Low warning buzz for mismatched or already dispatched code
 */
export function playErrorTone() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.linearRampToValueAtTime(160, now + 0.25);

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.25);
}

/**
 * Celebratory 3-note fanfare when all books for an order are finished
 */
export function playOrderCompleteFanfare() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const noteStart = now + idx * 0.1;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, noteStart);

    gain.gain.setValueAtTime(0.22, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteStart);
    osc.stop(noteStart + 0.4);
  });
}

/**
 * Speaks a clear human voice announcement (Paytm Soundbox style)
 * e.g., "Done! Next order."
 */
export function speakVoiceAnnouncement(text: string, onEnd?: () => void) {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(
          (v) => v.lang.includes('IN') || v.lang.includes('en-GB') || v.lang.includes('en-US')
        );
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        if (onEnd) {
          utterance.onend = () => onEnd();
          utterance.onerror = () => onEnd();
        }

        window.speechSynthesis.speak(utterance);
      }, 60);
    } else {
      onEnd?.();
    }
  } catch (e) {
    console.error('Speech synthesis error:', e);
    onEnd?.();
  }
}

/**
 * Speaks an announcement exactly 2 times with a natural pause in between,
 * and executes onAllDone ONLY after the 2nd time has completely finished speaking!
 */
export function speakVoiceTwice(
  text: string,
  onAllDone?: () => void,
  pauseMs: number = 500
) {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onAllDone?.();
      return;
    }

    window.speechSynthesis.cancel();

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) => v.lang.includes('IN') || v.lang.includes('en-GB') || v.lang.includes('en-US')
    );

    let hasCompleted = false;
    const triggerComplete = () => {
      if (!hasCompleted) {
        hasCompleted = true;
        onAllDone?.();
      }
    };

    const speakIteration = (isSecond: boolean) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => {
        if (!isSecond) {
          // Pause between 1st and 2nd announcement
          setTimeout(() => {
            speakIteration(true);
          }, pauseMs);
        } else {
          // 2nd announcement finished speaking!
          setTimeout(() => {
            triggerComplete();
          }, 600);
        }
      };

      utterance.onerror = (e) => {
        console.warn('Speech synthesis error in iteration:', e);
        if (!isSecond) {
          setTimeout(() => speakIteration(true), pauseMs);
        } else {
          triggerComplete();
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    setTimeout(() => {
      speakIteration(false);
    }, 80);
  } catch (e) {
    console.error('Speech synthesis error in speakVoiceTwice:', e);
    onAllDone?.();
  }
}

/**
 * Speaks an error alert message clearly, stripping emoji characters
 */
export function speakErrorMessage(rawMessage: string) {
  try {
    let clean = (rawMessage || '')
      .replace(/[❌⚠️❗🚫]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) {
      clean = 'Wrong barcode scanned. Please verify.';
    } else {
      const lower = clean.toLowerCase();
      if (!lower.startsWith('warning') && !lower.startsWith('wrong') && !lower.startsWith('error')) {
        clean = `Warning! ${clean}`;
      }
    }

    speakVoiceAnnouncement(clean);
  } catch (e) {
    console.error('Error speaking error message:', e);
  }
}
