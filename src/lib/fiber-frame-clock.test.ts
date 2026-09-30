import { createRoot } from "@react-three/fiber";
import { describe, expect, it, vi } from "vitest";

import { createFiberFrameClock, installFiberFrameClock, readFiberFrameClockFactory } from "@/lib/fiber-frame-clock";

describe("createFiberFrameClock", () => {
  it("does not construct the deprecated THREE.Clock", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const clock = createFiberFrameClock();
    clock.getDelta();
    expect(warn.mock.calls.some((args) => String(args[0]).includes("THREE.Clock"))).toBe(false);
    warn.mockRestore();
  });

  it("returns 0 on the first tick, then advances elapsed time", () => {
    const clock = createFiberFrameClock();
    expect(clock.getDelta()).toBe(0);
    expect(clock.elapsedTime).toBe(0);

    const started = performance.now();
    while (performance.now() - started < 20) {
      // Wait long enough for Timer to report a non-zero frame.
    }

    const delta = clock.getDelta();
    expect(delta).toBeGreaterThan(0.01);
    expect(delta).toBeLessThan(0.5);
    expect(clock.elapsedTime).toBeCloseTo(delta, 5);
  });

  it("stops advancing after stop()", () => {
    const clock = createFiberFrameClock();
    clock.getDelta();
    clock.stop();
    const elapsed = clock.elapsedTime;
    const started = performance.now();
    while (performance.now() - started < 15) {
      // Time passes while the clock is stopped.
    }
    expect(clock.getDelta()).toBe(0);
    expect(clock.elapsedTime).toBe(elapsed);
  });
});

describe("installFiberFrameClock", () => {
  it("publishes a factory fiber can call instead of THREE.Clock", () => {
    installFiberFrameClock();
    const factory = readFiberFrameClockFactory();
    expect(factory).toBeTypeOf("function");
    const clock = factory!();
    expect(clock.getDelta()).toBe(0);
    expect(typeof clock.getElapsedTime).toBe("function");
  });

  it("keeps react-three-fiber from constructing THREE.Clock", () => {
    installFiberFrameClock();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const root = createRoot({} as HTMLCanvasElement);
    root.unmount();
    expect(warn.mock.calls.some((args) => String(args[0]).includes("THREE.Clock"))).toBe(false);
    warn.mockRestore();
  });
});
