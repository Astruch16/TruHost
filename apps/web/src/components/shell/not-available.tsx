import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Compass } from 'lucide-react';
import { buttonStyles } from '../../lib/styles';

/**
 * Shown for a page this user can't use (an admin page for an owner or cleaner, someone else's property) and for
 * addresses that don't exist. Says so plainly and offers the way home, never a blank screen or an error. It doesn't
 * say which of the two it is, so it never confirms that something exists.
 */
export function NotAvailable({
  title = 'This page isn’t available',
  children = 'It doesn’t exist, or your account doesn’t have access to it. If you think it should, ask your TruHost contact.',
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex justify-center py-10 @2xl/content:py-16">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-card border border-line-soft bg-surface px-6 py-10 text-center @2xl/content:px-10">
        <span className="grid size-14 place-items-center rounded-full bg-sage-tint text-sage-deep">
          <Compass aria-hidden className="size-6" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{children}</p>
        </div>
        <Link to="/" className={buttonStyles()}>
          Go to your home page
        </Link>
      </div>
    </div>
  );
}
