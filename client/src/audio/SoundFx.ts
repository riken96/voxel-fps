import * as THREE from 'three';
import { WeaponId } from '@shared/combat/Weapons.ts';
import { BlockId } from '@shared/constants.ts';

/**
 * High-Fidelity Procedural 3D Audio Engine utilizing Web Audio API.
 * Features:
 * - HRTF (Head-Related Transfer Function) true 3D spatial panning.
 * - Distinct weapon sonic signatures (Assault Rifle, Sniper Rifle, Shotgun, Pistol).
 * - Rewarding Headshot metallic ding chime & bodyshot hitmarkers.
 * - Supersonic bullet whizz / snap audio for near-miss projectiles.
 * - Surface-adaptive footsteps (Concrete/Stone, Metal, Wood/Crate, Grass).
 * - Tactical weapon reloading soundscapes.
 * - Dynamic movement Foley (Slide glide, Mantle vault, Wall-kick, Jump-pad spring).
 */
export class SoundFx {
  private ctx: AudioContext | null = null;
  public enabled = true;
  public volume = 0.65;
  public sfxVolume = 1.0;

  // Master Gain Node for instant volume changes
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private initContext(): void {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);

      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMasterVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public setSFXVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  /**
   * Updates Web Audio listener orientation and 3D position to match the camera.
   */
  public updateListener(camera: THREE.PerspectiveCamera): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const pos = camera.position;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const up = camera.up;

    const listener = this.ctx.listener;
    if (listener.positionX) {
      listener.positionX.setValueAtTime(pos.x, t);
      listener.positionY.setValueAtTime(pos.y, t);
      listener.positionZ.setValueAtTime(pos.z, t);
      listener.forwardX.setValueAtTime(forward.x, t);
      listener.forwardY.setValueAtTime(forward.y, t);
      listener.forwardZ.setValueAtTime(forward.z, t);
      listener.upX.setValueAtTime(up.x, t);
      listener.upY.setValueAtTime(up.y, t);
      listener.upZ.setValueAtTime(up.z, t);
    } else {
      // Compatibility fallback
      listener.setPosition(pos.x, pos.y, pos.z);
      listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  /**
   * Helper to create an HRTF 3D spatial panner at given world coordinates.
   */
  private createPanner(x: number, y: number, z: number, refDist = 5, maxDist = 70): PannerNode | null {
    if (!this.ctx) return null;
    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = refDist;
    panner.maxDistance = maxDist;
    panner.rolloffFactor = 1.3;

    const t = this.ctx.currentTime;
    if (panner.positionX) {
      panner.positionX.setValueAtTime(x, t);
      panner.positionY.setValueAtTime(y, t);
      panner.positionZ.setValueAtTime(z, t);
    } else {
      panner.setPosition(x, y, z);
    }
    return panner;
  }

  // ---------------------------------------------------------------------------
  // WEAPON AUDIO
  // ---------------------------------------------------------------------------

  /**
   * Plays local player firing audio with weapon-specific acoustic profiles.
   */
  public playShoot(weaponId: WeaponId = WeaponId.ASSAULT_RIFLE, isADS = false): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const out = this.sfxGain;

    switch (weaponId) {
      case WeaponId.SNIPER_RIFLE: {
        // High-caliber heavy blast + long atmospheric tail
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1400, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.18);

        gain.gain.setValueAtTime(0.42, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

        osc.connect(gain);
        gain.connect(out);
        osc.start(t);
        osc.stop(t + 0.45);

        // Sub-bass boom
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(120, t);
        sub.frequency.exponentialRampToValueAtTime(28, t + 0.4);

        subGain.gain.setValueAtTime(0.5, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

        sub.connect(subGain);
        subGain.connect(out);
        sub.start(t);
        sub.stop(t + 0.4);
        break;
      }

      case WeaponId.SHOTGUN: {
        // Heavy concussive burst + wide multi-pellet spread pop
        const noiseBuffer = this.createNoiseBuffer(0.22);
        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, t);
        filter.frequency.exponentialRampToValueAtTime(200, t + 0.22);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        noise.start(t);

        // Heavy kick
        const thump = this.ctx.createOscillator();
        const thumpGain = this.ctx.createGain();
        thump.type = 'sine';
        thump.frequency.setValueAtTime(160, t);
        thump.frequency.exponentialRampToValueAtTime(35, t + 0.2);
        thumpGain.gain.setValueAtTime(0.38, t);
        thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        thump.connect(thumpGain);
        thumpGain.connect(out);
        thump.start(t);
        thump.stop(t + 0.2);
        break;
      }

      case WeaponId.PISTOL: {
        // Crisp, sharp mechanical snap
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1100, t);
        osc.frequency.exponentialRampToValueAtTime(140, t + 0.08);

        gain.gain.setValueAtTime(0.28, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        osc.connect(gain);
        gain.connect(out);
        osc.start(t);
        osc.stop(t + 0.08);
        break;
      }

      case WeaponId.ASSAULT_RIFLE:
      default: {
        // Military automatic rifle crack with sub thump
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(85, t + 0.09);

        gain.gain.setValueAtTime(0.26, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

        osc.connect(gain);
        gain.connect(out);
        osc.start(t);
        osc.stop(t + 0.09);

        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(140, t);
        sub.frequency.exponentialRampToValueAtTime(32, t + 0.16);
        subGain.gain.setValueAtTime(0.28, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

        sub.connect(subGain);
        subGain.connect(out);
        sub.start(t);
        sub.stop(t + 0.16);
        break;
      }
    }
  }

  /**
   * Plays a 3D positional gunshot from a remote player in the world.
   */
  public play3DShoot(x: number, y: number, z: number, weaponId: WeaponId = WeaponId.ASSAULT_RIFLE): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const panner = this.createPanner(x, y, z, 6, 85);
    if (!panner) return;

    panner.connect(this.sfxGain);
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = weaponId === WeaponId.SNIPER_RIFLE ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(weaponId === WeaponId.SNIPER_RIFLE ? 1100 : 700, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.18);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(panner);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  /**
   * Supersonic bullet snap / air displacement when an enemy bullet flies past the player.
   */
  public playBulletWhiz(proximityFactor = 1.0): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // High pitch Doppler zip-crack
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(3200, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.08);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, t);
    filter.Q.value = 3.5;

    gain.gain.setValueAtTime(0.18 * proximityFactor, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.08);
  }

  /**
   * Distinct Hitmarker feedback:
   * - isHeadshot=true: High-satisfaction metallic chime DING.
   * - isHeadshot=false: Crisp hit tick.
   */
  public playHitmarker(isHeadshot = false): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const out = this.sfxGain;

    if (isHeadshot) {
      // Golden metallic bell chime / ding
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(2489, t); // D#7 bell fundamental
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(3729, t); // Harmonic overtone

      gain.gain.setValueAtTime(0.38, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(out);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.28);
      osc2.stop(t + 0.28);
    } else {
      // Crisp hitmarker tick
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1700, t);
      osc.frequency.setValueAtTime(2250, t + 0.025);

      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.06);
    }
  }

  /**
   * Tactical reload sound: mag drop and fresh mag lock-in.
   */
  public playReload(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const out = this.sfxGain;

    // Mag release click
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(450, t);
    osc1.frequency.exponentialRampToValueAtTime(150, t + 0.07);
    gain1.gain.setValueAtTime(0.2, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc1.connect(gain1);
    gain1.connect(out);
    osc1.start(t);
    osc1.stop(t + 0.07);

    // Fresh magazine slap & bolt rack (delayed at t + 0.35s)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(320, t + 0.35);
    osc2.frequency.exponentialRampToValueAtTime(680, t + 0.42);
    gain2.gain.setValueAtTime(0, t);
    gain2.gain.setValueAtTime(0.28, t + 0.35);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
    osc2.connect(gain2);
    gain2.connect(out);
    osc2.start(t + 0.35);
    osc2.stop(t + 0.44);
  }

  // ---------------------------------------------------------------------------
  // MOVEMENT & SURFACE FOLEY AUDIO
  // ---------------------------------------------------------------------------

  /**
   * Surface-specific footstep audio.
   */
  public playFootstep(blockId?: BlockId): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    let startFreq = 110;
    let endFreq = 35;
    let filterFreq = 320;
    let oscType: OscillatorType = 'triangle';

    switch (blockId) {
      case BlockId.METAL_DARK:
      case BlockId.NEON_CYAN:
      case BlockId.NEON_ORANGE:
        // Metallic resonant tap
        oscType = 'sawtooth';
        startFreq = 380;
        endFreq = 90;
        filterFreq = 850;
        break;

      case BlockId.WOOD_PLANK:
      case BlockId.CRATE:
        // Hollow wooden thud
        oscType = 'sine';
        startFreq = 180;
        endFreq = 65;
        filterFreq = 420;
        break;

      case BlockId.GRASS:
      case BlockId.DIRT:
        // Soft earthy step
        oscType = 'triangle';
        startFreq = 95;
        endFreq = 28;
        filterFreq = 220;
        break;

      case BlockId.CONCRETE:
      case BlockId.STONE:
      case BlockId.BRICK:
      default:
        // Solid stone clatter
        oscType = 'triangle';
        startFreq = 130;
        endFreq = 45;
        filterFreq = 450;
        break;
    }

    osc.type = oscType;
    osc.frequency.setValueAtTime(startFreq + (Math.random() * 20 - 10), t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.08);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t);

    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.08);
  }

  public playJump(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.12);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  public playLand(impactVel?: number): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const intensity = impactVel ? Math.min(1.0, Math.abs(impactVel) / 18.0) : 0.6;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(22, t + 0.16);

    gain.gain.setValueAtTime(0.28 * intensity, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.16);
  }

  public playSlide(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.35);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(180, t + 0.35);

    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.35);
  }

  public playMantle(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.14);

    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.14);
  }

  public playWallJump(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.1);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  public playJumpPad(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(920, t + 0.28);

    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.28);
  }

  public playLavaSizzle(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(75, t);
    osc.frequency.setValueAtTime(160, t + 0.05);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.14);
  }

  public playKill(isHeadshot = false): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isHeadshot ? 1200 : 1050, t);
    osc.frequency.setValueAtTime(isHeadshot ? 1650 : 1400, t + 0.06);

    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.24);
  }

  public playBouncePad(): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.16);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.22);
  }

  public playMultikillFanfare(type: 'multikill' | 'headshot' | 'rampage'): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const notes = type === 'rampage' ? [523.25, 659.25, 783.99, 1046.5] : [440, 554.37, 659.25];
    const duration = 0.08;

    notes.forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * duration);

      const noteTime = t + i * duration;
      gain.gain.setValueAtTime(0.28, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(noteTime);
      osc.stop(noteTime + 0.18);
    });
  }

  /**
   * Powerful procedural explosion audio featuring deep sub-bass thump and noise rumble.
   */
  public playExplosion(x?: number, y?: number, z?: number): void {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;

    // 1. Sub-bass punch (120Hz down to 25Hz)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(120, t);
    subOsc.frequency.exponentialRampToValueAtTime(25, t + 0.6);

    subGain.gain.setValueAtTime(0.85, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

    subOsc.connect(subGain);

    // 2. Low-pass filtered noise rumble
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.9);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.8);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);

    noise.connect(filter);
    filter.connect(noiseGain);

    // Spatial Panning if 3D position is provided
    if (x !== undefined && y !== undefined && z !== undefined && this.ctx.createPanner) {
      const panner = this.ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 5;
      panner.maxDistance = 80;
      panner.rolloffFactor = 1.2;
      panner.positionX.setValueAtTime(x, t);
      panner.positionY.setValueAtTime(y, t);
      panner.positionZ.setValueAtTime(z, t);

      subGain.connect(panner);
      noiseGain.connect(panner);
      panner.connect(this.sfxGain);
    } else {
      subGain.connect(this.sfxGain);
      noiseGain.connect(this.sfxGain);
    }

    subOsc.start(t);
    subOsc.stop(t + 0.75);
    noise.start(t);
    noise.stop(t + 0.9);
  }

  private createNoiseBuffer(duration: number): AudioBuffer {
    if (!this.ctx) throw new Error('AudioContext not initialized');
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}
