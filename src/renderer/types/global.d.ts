import type { InknoteApi } from '../../shared/bridge';

declare global {
  interface Window {
    inknote: InknoteApi;
  }
}

export {};
