/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETWORK_ID?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_LOG_LEVEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
