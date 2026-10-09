import { createContext, useContext } from 'react';

/** True inside the portal frame (AppShell): loading there fills the content area, not the whole screen. */
export const ShellContext = createContext(false);
export const useInShell = () => useContext(ShellContext);

/** Sign-in pages, which load against the night sky rather than the portal outline. */
export const isAuthPath = (pathname: string) => /^\/(sign-in|sign-up|sso-callback)(\/|$)/.test(pathname);
