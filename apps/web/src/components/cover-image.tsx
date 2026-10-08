import { useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cx } from '../lib/cx';

/**
 * A property photo from a short-lived signed link. Loads lazily; if the link has expired by the time it loads (a
 * page left open for a while), it shows the fallback and refetches property data once for fresh links.
 */
export function CoverImage({
  url,
  alt,
  fallback,
  className,
  eager = false,
}: {
  url: string | null | undefined;
  /** Empty when the property's name is shown next to the photo. */
  alt: string;
  fallback: ReactNode;
  className?: string;
  eager?: boolean;
}) {
  const qc = useQueryClient();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const refreshed = useRef(false);
  if (!url || failedUrl === url) return <>{fallback}</>;
  return (
    <img
      src={url}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={cx('object-cover', className)}
      onError={() => {
        setFailedUrl(url);
        if (refreshed.current) return;
        refreshed.current = true;
        void qc.invalidateQueries({ queryKey: ['properties'] });
        void qc.invalidateQueries({ queryKey: ['dashboard'] });
      }}
    />
  );
}
