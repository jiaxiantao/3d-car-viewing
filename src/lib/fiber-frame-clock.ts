import { Timer } from "three";

/**
 * React Three Fiber still constructs `THREE.Clock`, which warns on Three r183+.
 * This clock keeps Clock's start/stop/getDelta/elapsedTime contract and reads
 * time from `THREE.Timer`, so the frame loop does not touch the deprecated class.
 */
export type FiberFrameClock = {
  autoStart: boolean;
  startTime: number;
  oldTime: number;
  elapsedTime: number;
  running: boolean;
  start: () => void;
  stop: () => void;
  getDelta: () => number;
  getElapsedTime: () => number;
};

export function createFiberFrameClock(autoStart = true): FiberFrameClock {
  const timer = new Timer();
  const clock: FiberFrameClock = {
    autoStart,
    startTime: 0,
    oldTime: 0,
    elapsedTime: 0,
    running: false,
    start() {
      const timestamp = performance.now();
      this.startTime = timestamp;
      this.oldTime = timestamp;
      this.elapsedTime = 0;
      this.running = true;
      // Align the timer to this instant and discard the pre-start delta.
      timer.reset();
      timer.update(timestamp);
    },
    stop() {
      this.getElapsedTime();
      this.running = false;
      this.autoStart = false;
    },
    getElapsedTime() {
      this.getDelta();
      return this.elapsedTime;
    },
    getDelta() {
      if (this.autoStart && !this.running) {
        this.start();
        return 0;
      }
      if (!this.running) {
        return 0;
      }
      const timestamp = performance.now();
      timer.update(timestamp);
      const delta = timer.getDelta();
      this.oldTime = timestamp;
      this.elapsedTime += delta;
      return delta;
    },
  };
  return clock;
}

const FRAME_CLOCK = Symbol.for("showroom.fiberFrameClock");

type FrameClockGlobal = typeof globalThis & {
  [FRAME_CLOCK]?: () => FiberFrameClock;
};

export function installFiberFrameClock() {
  (globalThis as FrameClockGlobal)[FRAME_CLOCK] = () => createFiberFrameClock();
}

export function readFiberFrameClockFactory(): (() => FiberFrameClock) | undefined {
  return (globalThis as FrameClockGlobal)[FRAME_CLOCK];
}
