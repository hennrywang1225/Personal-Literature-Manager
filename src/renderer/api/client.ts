import type { LiteratureApi } from '../../main/preload'

declare global {
  interface Window {
    literature: LiteratureApi
  }
}

export const libraryApi = window.literature
