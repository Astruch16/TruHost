import { useId } from 'react';

/**
 * Shared gradients of the empty state illustrations (docs/design/EmptyIcons.dc.html: eiShadow, eiSheen, eiGold,
 * eiPaper). Ids are unique per instance, so several illustrations can share a page.
 */
export function useIllustrationIds() {
  const base = 'ei' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = { shadow: `${base}-shadow`, sheen: `${base}-sheen`, gold: `${base}-gold`, paper: `${base}-paper` };
  const url = {
    shadow: `url(#${id.shadow})`,
    sheen: `url(#${id.sheen})`,
    gold: `url(#${id.gold})`,
    paper: `url(#${id.paper})`,
  };
  return { id, url };
}
