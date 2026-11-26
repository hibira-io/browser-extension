// Voice in the browser: push-to-talk with the Web Speech API where the
// browser has it (Chrome, Edge, Safari), and answers read aloud with
// speechSynthesis. Nothing leaves the browser for this but what the
// browser's own speech service hears; the microphone is asked for only
// when the person presses the mic button.

interface Recognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canListen = () => ctor() !== null;
export const canSpeak = () => typeof speechSynthesis !== 'undefined';

/** Listens until the person stops talking; onText gets the words so far. */
export function listen(lang: string, onText: (text: string, final: boolean) => void, onEnd: (err?: string) => void): () => void {
  const C = ctor();
  if (!C) {
    onEnd('unsupported');
    return () => undefined;
  }
  const r = new C();
  r.lang = lang;
  r.interimResults = true;
  r.continuous = false;
  let text = '';
  r.onresult = (e) => {
    text = Array.from(e.results)
      .map((x) => x[0].transcript)
      .join('');
    const last = e.results[e.results.length - 1];
    onText(text, !!last?.isFinal);
  };
  r.onerror = (e) => onEnd(e.error);
  r.onend = () => onEnd();
  r.start();
  return () => r.stop();
}

export function speak(text: string, lang: string) {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[*_`#>]/g, ''));
  u.lang = lang;
  speechSynthesis.speak(u);
}

export function hush() {
  if (canSpeak()) speechSynthesis.cancel();
}
