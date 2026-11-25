import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWakeLock } from '../hooks/useWakeLock';

interface FakeSentinel {
  released: boolean;
  release: ReturnType<typeof vi.fn>;
}

let sentinels: FakeSentinel[];
let request: ReturnType<typeof vi.fn>;

const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  sentinels = [];
  request = vi.fn(async () => {
    const sentinel: FakeSentinel = {
      released: false,
      release: vi.fn(async () => {
        sentinel.released = true;
      }),
    };
    sentinels.push(sentinel);
    return sentinel;
  });
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'wakeLock');
});

describe('useWakeLock', () => {
  it('does nothing while disabled', () => {
    renderHook(() => useWakeLock(false));
    expect(request).not.toHaveBeenCalled();
  });

  it('holds a screen lock and releases it when switched off', async () => {
    const { rerender } = renderHook(({ enabled }) => useWakeLock(enabled), {
      initialProps: { enabled: true },
    });
    await act(async () => {});
    expect(request).toHaveBeenCalledWith('screen');

    rerender({ enabled: false });
    expect(sentinels[0].release).toHaveBeenCalled();
  });

  it('asks again when the page comes back after the browser dropped the lock', async () => {
    renderHook(() => useWakeLock(true));
    await act(async () => {});
    sentinels[0].released = true;

    await act(async () => setVisibility('hidden'));
    expect(request).toHaveBeenCalledTimes(1);

    await act(async () => setVisibility('visible'));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not stack locks on every tap', async () => {
    renderHook(() => useWakeLock(true));
    await act(async () => {});

    await act(async () => {
      document.dispatchEvent(new Event('pointerdown'));
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('leaves browsers without the API alone', () => {
    Reflect.deleteProperty(navigator, 'wakeLock');
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });
});
