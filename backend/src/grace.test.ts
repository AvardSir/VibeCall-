import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGraceService } from './grace.js';

function harness(graceSeconds = 3) {
  const started: Array<[string, number]> = [];
  const registry = {
    get: vi.fn(() => ({ roomId: 'r1', status: 'active', graceEndsAt: null })),
    startGraceState: vi.fn((id: string, endsAt: number) => started.push([id, endsAt])),
    clearGraceState: vi.fn(),
    markEnded: vi.fn(),
  };
  const admin = { deleteRoom: vi.fn().mockResolvedValue(undefined) };
  const ticks: number[] = [];
  const events: string[] = [];
  const svc = createGraceService({
    registry: registry as never, admin: admin as never, graceSeconds,
    onTick: (_id, s) => ticks.push(s),
    onCancelled: () => events.push('cancelled'),
    onEnded: () => events.push('ended'),
  });
  return { svc, registry, admin, ticks, events };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createGraceService', () => {
  it('emits an immediate tick with the full countdown and marks grace state', () => {
    const { svc, registry, ticks } = harness(3);
    svc.startGrace('r1');
    expect(ticks[0]).toBe(3);
    expect(registry.startGraceState).toHaveBeenCalled();
    expect(svc.isInGrace('r1')).toBe(true);
  });

  it('ticks down each second and ends the room at zero', async () => {
    const { svc, admin, registry, ticks, events } = harness(3);
    svc.startGrace('r1');
    await vi.advanceTimersByTimeAsync(3000);
    expect(ticks).toEqual([3, 2, 1]);       // ticks at t=0,1,2s; t=3s triggers end
    expect(admin.deleteRoom).toHaveBeenCalledWith('r1');
    expect(registry.markEnded).toHaveBeenCalledWith('r1');
    expect(events).toContain('ended');
    expect(svc.isInGrace('r1')).toBe(false);
  });

  it('remainingSeconds reflects the live countdown and is null outside grace', async () => {
    const { svc } = harness(3);
    expect(svc.remainingSeconds('r1')).toBeNull(); // not in grace yet
    svc.startGrace('r1');
    expect(svc.remainingSeconds('r1')).toBe(3);     // full countdown at t=0
    await vi.advanceTimersByTimeAsync(1000);
    expect(svc.remainingSeconds('r1')).toBe(2);     // ticked down after 1s
    svc.cancelGrace('r1');
    expect(svc.remainingSeconds('r1')).toBeNull();  // cleared once grace ends
  });

  it('cancelGrace stops the timer and restores active state', () => {
    const { svc, registry, events } = harness(3);
    svc.startGrace('r1');
    svc.cancelGrace('r1');
    expect(registry.clearGraceState).toHaveBeenCalledWith('r1');
    expect(events).toContain('cancelled');
    expect(svc.isInGrace('r1')).toBe(false);
  });

  it('startGrace is idempotent while already in grace', () => {
    const { svc, registry } = harness(3);
    svc.startGrace('r1');
    svc.startGrace('r1');
    expect(registry.startGraceState).toHaveBeenCalledTimes(1);
  });

  it('calls onCleanup with the roomId after markEnded and before onEnded', async () => {
    const registry = {
      get: vi.fn(() => ({ roomId: 'r1', status: 'active', graceEndsAt: null })),
      startGraceState: vi.fn(),
      clearGraceState: vi.fn(),
      markEnded: vi.fn(),
    };
    const admin = { deleteRoom: vi.fn().mockResolvedValue(undefined) };
    const callOrder: string[] = [];
    registry.markEnded.mockImplementation(() => callOrder.push('markEnded'));
    const onCleanup = vi.fn((_roomId: string) => callOrder.push('onCleanup'));
    const onEnded = vi.fn(() => callOrder.push('onEnded'));
    const svc = createGraceService({
      registry: registry as never,
      admin: admin as never,
      graceSeconds: 3,
      onTick: () => {},
      onCancelled: () => {},
      onEnded,
      onCleanup,
    });

    svc.startGrace('r1');
    await vi.advanceTimersByTimeAsync(3000);

    expect(onCleanup).toHaveBeenCalledWith('r1');
    expect(callOrder).toEqual(['markEnded', 'onCleanup', 'onEnded']);
  });
});
