import type { ReactNode } from 'react';
import { Logo } from './logo';
import { MountainScene } from './mountain-scene';

/**
 * Two-panel frame for sign-in, sign-up and account-state pages: brand panel with the scene on the left (desktop),
 * content on the right.
 */
export function AuthFrame({
  title,
  description,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh bg-ground lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="relative hidden overflow-hidden bg-sidebar [--scene-w:41.6vw] lg:block">
        <div className="relative z-10 p-10">
          <Logo />
        </div>
        <p
          aria-hidden
          className="absolute inset-x-0 bottom-[max(330px,calc(var(--scene-w)*0.62))] z-10 -rotate-3 text-center font-hand text-4xl leading-tight text-sidebar-ink/90"
        >
          Better stays.
          <br />
          Higher returns.
        </p>
        <MountainScene width={600} className="absolute inset-x-0 bottom-0 aspect-[600/330] min-h-[330px] w-full" />
      </div>
      <main className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-6 rounded-card bg-sidebar p-5 lg:hidden">
            <Logo />
          </div>
          {(title || description) && (
            <div className="mb-5">
              {title && <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>}
              {description && <p className="mt-2 text-muted">{description}</p>}
            </div>
          )}
          <div className="flex flex-col gap-4">{children}</div>
        </div>
      </main>
    </div>
  );
}
