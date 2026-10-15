import { useEffect, useState } from 'react';
import { App } from '../App.tsx';
import { NAVIGATE_EVENT, navigateTo } from '../navigation.ts';
import { LoginPage } from './LoginPage.tsx';
import { PasswordLinkPage, PASSWORD_LINK_PATH } from './PasswordLinkPage.tsx';
import { LOGIN_PATH, useSession } from './SessionContext.tsx';

/**
 * Pages de connexion (/connexion, /mot-de-passe#jeton) ; toutes les autres sont l'application,
 * consultable sans compte. La connexion s'affiche par-dessus l'application, qui reste montée : un
 * deck en cours de composition n'est pas perdu.
 */
export function AuthGate() {
  const session = useSession();
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    window.addEventListener(NAVIGATE_EVENT, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(NAVIGATE_EVENT, update);
    };
  }, []);

  if (path === PASSWORD_LINK_PATH) {
    return (
      <PasswordLinkPage
        onDone={(account) => {
          session.signedIn(account);
          window.history.replaceState(null, '', '/');
          setPath('/');
        }}
      />
    );
  }
  return (
    <>
      <div inert={path === LOGIN_PATH}>
        <App />
      </div>
      {path === LOGIN_PATH && (
        <LoginPage
          overlay
          onSignedIn={(account) => {
            session.signedIn(account);
            navigateTo(session.takeReturnPath());
          }}
          onCancel={() => navigateTo(session.takeReturnPath())}
        />
      )}
    </>
  );
}
