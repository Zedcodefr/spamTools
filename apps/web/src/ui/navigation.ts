/** Navigation interne hors des outils (connexion, retour) : change l'URL et prévient les composants. */
export const NAVIGATE_EVENT = 'spamtools:navigate';

export function navigateTo(path: string): void {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}
