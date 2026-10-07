import { createContext, useContext } from 'react';
import type { GuideCharacter } from './guides';

/** The signed-in user's chosen guide (Settings). Sage outside the signed-in app, e.g. on the dev style guide. */
export const GuideContext = createContext<GuideCharacter>('sage');
export const useMyGuide = () => useContext(GuideContext);
