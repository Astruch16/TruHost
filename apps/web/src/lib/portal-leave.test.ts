import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const signOut = vi.fn(() => Promise.resolve());
const navigate = vi.fn(() => Promise.resolve());
const router = { state: { location: { pathname: '/admin' } }, navigate };
vi.mock('@clerk/react', () => ({ useClerk: () => ({ signOut }) }));
vi.mock('@tanstack/react-router', () => ({ useRouter: () => router }));

const { useLeavePortal } = await import('./portal-entry');

afterEach(() => {
  vi.clearAllMocks();
  delete (document as { startViewTransition?: unknown }).startViewTransition;
  router.state.location.pathname = '/admin';
});

describe('useLeavePortal', () => {
  it('signs out and opens the sign-in page (no view transitions: no fade)', async () => {
    const { result } = renderHook(() => useLeavePortal());
    await result.current();
    expect(signOut).toHaveBeenCalledWith({ redirectUrl: '/sign-in' });
    expect(navigate).toHaveBeenCalledWith({ to: '/sign-in/$', params: { _splat: '' }, replace: true });
  });

  it("doesn't navigate again when Clerk has already opened the sign-in page", async () => {
    signOut.mockImplementationOnce(async () => {
      router.state.location.pathname = '/sign-in';
    });
    const { result } = renderHook(() => useLeavePortal());
    await result.current();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('signs out inside a "leave-portal" view transition, so the portal fades into the sign-in page', async () => {
    const calls: unknown[] = [];
    document.startViewTransition = vi.fn((arg: unknown) => {
      calls.push(arg);
      const update = typeof arg === 'function' ? arg : (arg as { update: () => Promise<void> }).update;
      return { updateCallbackDone: update() } as unknown as ViewTransition;
    }) as unknown as typeof document.startViewTransition;
    vi.stubGlobal('CSS', { supports: () => true });
    const { result } = renderHook(() => useLeavePortal());
    await result.current();
    expect(calls[0]).toMatchObject({ types: ['leave-portal'] });
    expect(signOut).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
