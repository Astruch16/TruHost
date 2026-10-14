/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** From package.json, at build time (vite.config.ts). */
declare const __APP_VERSION__: string;
/** The commit the build came from (7 characters), or "dev". */
declare const __APP_COMMIT__: string;
