import { useCallback, useRef, useState, useEffect } from 'react';

interface TrackConfig {
  type: 'lofi' | 'focus' | 'nature' | 'meditation';
  bpm?: number;
}

function readStoredVolume(): number {
  try {
    const v = Number(localStorage.getItem('nq_volume'));
    return Number.isFinite(v) && v > 0 ? Math.min(v, 1) : 0.8;
  } catch { return 0.8; }
}

export function useAudioEngine() {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{ stop: () => void }[]>([]);
  // Master gain sits between every source and the destination so volume
  // applies to whichever generator is running.
  const masterRef = useRef<GainNode | null>(null);
  const [volume, setVolumeState] = useState(readStoredVolume);
  const volumeRef = useRef<number>(volume);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);

  const getCtx = useCallback(async (): Promise<AudioContext> => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      masterRef.current = ctxRef.current.createGain();
      masterRef.current.gain.value = volumeRef.current;
      masterRef.current.connect(ctxRef.current.destination);
    }
    if (ctxRef.current.state === 'suspended') {
      await ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  // All generators route through the master gain.
  const out = useCallback((): GainNode => masterRef.current!, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    volumeRef.current = clamped;
    setVolumeState(clamped);
    try { localStorage.setItem('nq_volume', String(clamped)); } catch { /* private mode */ }
    if (masterRef.current && ctxRef.current) {
      masterRef.current.gain.setTargetAtTime(clamped, ctxRef.current.currentTime, 0.05);
    }
  }, []);

  const stopAll = useCallback(() => {
    nodesRef.current.forEach(n => n.stop());
    nodesRef.current = [];
    setIsPlaying(false);
    setCurrentTrack(null);
  }, []);

  // Lo-fi beat: detuned chords + vinyl crackle + slow hi-hat
  const playLofi = useCallback(async (bpm = 75) => {
    const ctx = await getCtx();
    const beatLen = 60 / bpm;
    const nodes: { stop: () => void }[] = [];

    // Chord pad (jazzy 7th chord)
    const chords = [
      [261.6, 329.6, 392.0, 493.9], // Cmaj7
      [293.7, 370.0, 440.0, 523.3], // Dm7
      [349.2, 440.0, 523.3, 659.3], // Fmaj7
      [392.0, 493.9, 587.3, 740.0], // G7
    ];

    let chordIdx = 0;
    let running = true;

    const playChord = () => {
      if (!running) return;
      const chord = chords[chordIdx % chords.length];
      chordIdx++;
      chord.forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = 'sine';
        osc.frequency.value = freq * 0.998; // detune
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + beatLen * 3.5);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(out());
        osc.start();
        osc.stop(ctx.currentTime + beatLen * 4);
      });
      setTimeout(playChord, beatLen * 4000);
    };

    // Vinyl crackle (noise burst)
    const playCrackle = () => {
      if (!running) return;
      const bufferSize = ctx.sampleRate * 0.05;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() < 0.02 ? (Math.random() - 0.5) * 0.3 : (Math.random() - 0.5) * 0.01;
      }
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      source.buffer = buffer;
      filter.type = 'highpass';
      filter.frequency.value = 1000;
      gain.gain.value = 0.15;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(out());
      source.start();
      setTimeout(playCrackle, 100 + Math.random() * 300);
    };

    // Hi-hat
    const playHihat = () => {
      if (!running) return;
      const bufferSize = ctx.sampleRate * 0.05;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() - 0.5) * Math.exp(-i / (bufferSize * 0.15));
      }
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      source.buffer = buffer;
      filter.type = 'highpass';
      filter.frequency.value = 7000;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(out());
      source.start();
      setTimeout(playHihat, beatLen * 2000);
    };

    // Kick
    const playKick = () => {
      if (!running) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(out());
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      setTimeout(playKick, beatLen * 4000);
    };

    playChord();
    playCrackle();
    playHihat();
    setTimeout(playKick, beatLen * 2000);

    nodes.push({ stop: () => { running = false; } });
    return nodes;
  }, [getCtx, out]);

  // Focus: slow evolving pad
  const playFocus = useCallback(async () => {
    const ctx = await getCtx();
    const nodes: { stop: () => void }[] = [];
    let running = true;

    const notes = [220, 277.2, 329.6, 440, 554.4]; // A minor pentatonic
    let noteIdx = 0;

    const playPad = () => {
      if (!running) return;
      const freq = notes[noteIdx % notes.length];
      noteIdx++;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = 'sine';
      osc.frequency.value = freq;
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      filter.Q.value = 2;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 2);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 6);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(out());
      osc.start();
      osc.stop(ctx.currentTime + 6);
      setTimeout(playPad, 4000);
    };

    playPad();
    nodes.push({ stop: () => { running = false; } });
    return nodes;
  }, [getCtx, out]);

  // Nature: filtered noise (rain/wind)
  const playNature = useCallback(async () => {
    const ctx = await getCtx();
    const nodes: { stop: () => void }[] = [];
    let running = true;

    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() - 0.5) * 2;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.5;

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1;
    lfoGain.gain.value = 200;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const gain = ctx.createGain();
    gain.gain.value = 0.15;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(out());
    source.start();

    nodes.push({ stop: () => { running = false; source.stop(); lfo.stop(); } });
    return nodes;
  }, [getCtx, out]);

  // Meditation: slow breathing guide tones
  const playMeditation = useCallback(async () => {
    const ctx = await getCtx();
    const nodes: { stop: () => void }[] = [];
    let running = true;

    const breathCycle = () => {
      if (!running) return;
      // Inhale (4s)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = 174.6; // F3
      gain1.gain.setValueAtTime(0, ctx.currentTime);
      gain1.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 4);
      gain1.gain.linearRampToValueAtTime(0, ctx.currentTime + 8);
      osc1.connect(gain1);
      gain1.connect(out());
      osc1.start();
      osc1.stop(ctx.currentTime + 8);

      // Exhale (4s) starts after inhale
      setTimeout(() => {
        if (!running) return;
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = 130.8; // C3
        gain2.gain.setValueAtTime(0, ctx.currentTime);
        gain2.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 4);
        gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 8);
        osc2.connect(gain2);
        gain2.connect(out());
        osc2.start();
        osc2.stop(ctx.currentTime + 8);
      }, 4000);

      setTimeout(breathCycle, 12000);
    };

    breathCycle();
    nodes.push({ stop: () => { running = false; } });
    return nodes;
  }, [getCtx, out]);

  const play = useCallback(async (trackId: string, config: TrackConfig) => {
    stopAll();
    let nodes: { stop: () => void }[] = [];
    switch (config.type) {
      case 'lofi': nodes = await playLofi(config.bpm); break;
      case 'focus': nodes = await playFocus(); break;
      case 'nature': nodes = await playNature(); break;
      case 'meditation': nodes = await playMeditation(); break;
    }
    nodesRef.current = nodes;
    setIsPlaying(true);
    setCurrentTrack(trackId);
  }, [stopAll, playLofi, playFocus, playNature, playMeditation]);

  const toggle = useCallback(async (trackId: string, config: TrackConfig) => {
    if (isPlaying && currentTrack === trackId) {
      stopAll();
    } else {
      await play(trackId, config);
    }
  }, [isPlaying, currentTrack, stopAll, play]);

  // Suspend/resume AudioContext automatically when tab is hidden/visible
  useEffect(() => {
    const handler = () => {
      if (!ctxRef.current) return;
      if (document.hidden) {
        ctxRef.current.suspend().catch(() => {});
      } else {
        ctxRef.current.resume().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopAll(), [stopAll]);

  return { isPlaying, currentTrack, play, stop: stopAll, toggle, volume, setVolume };
}
