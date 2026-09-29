import { TILT } from '../data/balance';
import type { InputFrame } from '../sim/types';
import type { InputSource } from './inputFrame';

export type TiltStatus = 'off' | 'pending' | 'on' | 'denied' | 'unsupported';

/** Device pitch (`beta`, front/back) and roll (`gamma`, left/right) in degrees, as `deviceorientation` reports them. */
export interface Orientation {
  beta: number;
  gamma: number;
}

/** Asks for sensor access (iOS); resolves `'granted'` or `'denied'`, rejects when not called from a user gesture. */
export type PermissionRequest = () => Promise<string>;

/**
 * Rotates pitch/roll into screen axes for the screen's orientation angle (0/90/180/270). Positive x = the
 * screen's right edge dipping, positive y = its bottom edge dipping (tilting the phone back toward the player).
 */
export function screenTilt(o: Orientation, angle: number): { x: number; y: number } {
  switch ((((angle % 360) + 360) % 360) as 0 | 90 | 180 | 270) {
    case 90:
      return { x: -o.beta, y: -o.gamma };
    case 180:
      return { x: -o.gamma, y: -o.beta };
    case 270:
      return { x: o.beta, y: o.gamma };
    default:
      return { x: o.gamma, y: o.beta };
  }
}

/** Degrees away from neutral → -1..1, with a dead zone and a linear ramp to full deflection. */
export function tiltAxis(deltaDeg: number, deadZone = TILT.deadZoneDeg, full = TILT.fullDeg): number {
  const m = Math.abs(deltaDeg);
  if (m <= deadZone) return 0;
  return Math.sign(deltaDeg) * Math.min(1, (m - deadZone) / (full - deadZone));
}

const IDLE: InputFrame = {
  moveX: 0,
  moveY: 0,
  dragX: 0,
  dragY: 0,
  firePressed: false,
  fireOnBeat: null,
  firePerfect: false,
  beat: null,
};

/**
 * Steers by tilting the device away from a neutral pose. The pose is captured when tilt is enabled and on
 * `recenter()` (run start, unpause), and again whenever the screen orientation changes.
 */
export class TiltInput implements InputSource {
  status: TiltStatus = 'off';
  private latest: Orientation | null = null;
  private neutral: Orientation | null = null;
  private neutralAngle = 0;
  private listening = false;
  private readonly onOrientation = (e: Event) => {
    const { beta, gamma } = e as DeviceOrientationEvent;
    if (typeof beta !== 'number' || typeof gamma !== 'number') return;
    this.latest = { beta, gamma };
    if (this.neutral === null) this.recenter();
  };
  private readonly onGesture = () => {
    this.stopGestureRetry();
    if (this.status === 'pending') this.request();
  };

  constructor(
    /** Fires `deviceorientation` (the window). */
    private readonly sensor: EventTarget,
    /** Receives the pointer events that count as user gestures for the permission prompt. */
    private readonly gestures: EventTarget,
    private readonly permission: PermissionRequest | null,
    private readonly angle: () => number,
    supported = true,
  ) {
    if (!supported) this.status = 'unsupported';
  }

  setEnabled(on: boolean): void {
    if (this.status === 'unsupported') return;
    if (!on) {
      this.stop();
      this.status = 'off';
      return;
    }
    if (this.status === 'on' || this.status === 'pending') return;
    this.status = 'pending';
    this.request();
  }

  recenter(): void {
    this.neutral = this.latest;
    this.neutralAngle = this.angle();
  }

  poll(): InputFrame {
    if (this.status !== 'on' || this.latest === null || this.neutral === null) return IDLE;
    const angle = this.angle();
    if (angle !== this.neutralAngle) this.recenter();
    const now = screenTilt(this.latest, angle);
    const base = screenTilt(this.neutral!, angle);
    return { ...IDLE, moveX: tiltAxis(now.x - base.x), moveY: tiltAxis(now.y - base.y) };
  }

  private request(): void {
    if (!this.permission) return this.start();
    this.permission().then(
      (r) => {
        if (this.status !== 'pending') return;
        if (r === 'granted') this.start();
        else this.status = 'denied';
      },
      // Not from a user gesture: ask again on the next press.
      () => {
        if (this.status !== 'pending') return;
        for (const t of ['pointerdown', 'pointerup']) this.gestures.addEventListener(t, this.onGesture);
      },
    );
  }

  private stopGestureRetry(): void {
    for (const t of ['pointerdown', 'pointerup']) this.gestures.removeEventListener(t, this.onGesture);
  }

  private start(): void {
    this.status = 'on';
    if (this.listening) return;
    this.listening = true;
    this.sensor.addEventListener('deviceorientation', this.onOrientation);
    this.recenter();
  }

  private stop(): void {
    this.stopGestureRetry();
    if (this.listening) this.sensor.removeEventListener('deviceorientation', this.onOrientation);
    this.listening = false;
    this.latest = this.neutral = null;
  }
}

/** The browser's tilt source; `gestures` is the element whose presses may satisfy iOS's permission prompt. */
export function browserTilt(gestures: EventTarget): TiltInput {
  const supported = typeof DeviceOrientationEvent !== 'undefined' && window.isSecureContext;
  const ctor = supported ? (DeviceOrientationEvent as unknown as { requestPermission?: PermissionRequest }) : {};
  const permission = typeof ctor.requestPermission === 'function' ? () => ctor.requestPermission!() : null;
  const angle = () =>
    screen.orientation?.angle ?? ((window as unknown as { orientation?: number }).orientation || 0);
  return new TiltInput(window, gestures, permission, angle, supported);
}
