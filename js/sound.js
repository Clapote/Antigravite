/**
 * Antigravité - Module Audio & Synthèse Sonore (Web Audio API)
 * Synthétiseur sonore haute fidélité autonome : aucun fichier externe requis.
 */

const SoundManager = {
  ctx: null,

  getContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  },

  playSound(soundType = 'zen', volume = 0.6) {
    if (soundType === 'none' || volume <= 0) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      const safeVolume = Math.max(0, Math.min(1, Number(volume) || 0.6));
      masterGain.gain.setValueAtTime(safeVolume, now);
      masterGain.connect(ctx.destination);

      if (soundType === 'zen') {
        // Tintement Zen / Bol tibétain doux (fondamentale 528 Hz - fréquence de résonance réparatrice)
        [528, 1056, 1584].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          const baseAmp = [0.45, 0.18, 0.06][idx];
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(baseAmp, now + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now);
          osc.stop(now + 1.8);
        });
      } else if (soundType === 'chime') {
        // Carillon mélodieux majeur (arpège ascendant doux : C5, E5, G5, C6)
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = now + (idx * 0.09);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);

          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.65);

          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(start);
          osc.stop(start + 0.65);
        });
      } else if (soundType === 'pop') {
        // Goutte d'eau liquide / Bip subtil
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(420, now + 0.14);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.4, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.18);
      }
    } catch (e) {
      console.warn("[SoundManager] Erreur lecture audio :", e);
    }
  }
};

if (typeof window !== 'undefined') {
  window.SoundManager = SoundManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SoundManager;
}
