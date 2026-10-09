import { useState } from 'react';
import { cx } from '../../lib/cx';

/**
 * A person's profile photo (a short-lived signed link), or their initials on lavender when there is none or the
 * link has expired. Size and shape come from `className` (e.g. "size-10").
 */
export function Avatar({
  url,
  initials,
  className,
  alt = '',
}: {
  url: string | null | undefined;
  initials: string;
  className?: string;
  /** Empty when the person's name is shown next to it. */
  alt?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <span
      className={cx(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-lavender-tint font-bold text-lavender-deep',
        className,
      )}
    >
      {url && failedUrl !== url ? (
        <img
          src={url}
          alt={alt}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <span aria-hidden={alt ? undefined : true}>{initials}</span>
      )}
    </span>
  );
}
