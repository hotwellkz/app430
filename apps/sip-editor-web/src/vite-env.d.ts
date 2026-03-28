/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** Таймаут JSON-запросов к SIP API, мс (по умолчанию 120000). */
  readonly VITE_SIP_API_TIMEOUT_MS?: string;
  /** Таймаут multipart-загрузки (import-sources), мс (по умолчанию 600000). */
  readonly VITE_SIP_API_UPLOAD_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
