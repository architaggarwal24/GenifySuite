/**
 * Tiny event bridge for the global login/signup popup (<AuthModal />, mounted once in the root
 * layout). Any client code - navbar, locked tool pages, CTAs - can open it without prop drilling,
 * the same way the command palette is opened.
 */
export const AUTH_MODAL_EVENT = "genifysuite:open-auth";

export type AuthModalMode = "login" | "register";

export interface AuthModalDetail {
  mode?: AuthModalMode;
  /** Where to send the person after they sign in. Defaults to staying on the current page. */
  redirectTo?: string;
}

export function openAuthModal(detail: AuthModalDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AuthModalDetail>(AUTH_MODAL_EVENT, { detail }));
}
