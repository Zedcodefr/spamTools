import { MIN_PASSWORD_LENGTH } from '../../domain/Account.ts';

/** Nouveau mot de passe et sa confirmation ; `problem` dit ce qui empêche de valider. */
export function passwordProblem(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `${MIN_PASSWORD_LENGTH} caractères au moins (une phrase de quelques mots convient).`;
  }
  return password === confirmation ? null : 'Les deux saisies sont différentes.';
}

interface PasswordFieldsProps {
  readonly password: string;
  readonly confirmation: string;
  readonly onPassword: (value: string) => void;
  readonly onConfirmation: (value: string) => void;
}

export function PasswordFields({ password, confirmation, onPassword, onConfirmation }: PasswordFieldsProps) {
  const problem = password === '' && confirmation === '' ? null : passwordProblem(password, confirmation);
  return (
    <>
      <label>
        Nouveau mot de passe
        <input
          type="password"
          value={password}
          onChange={(event) => onPassword(event.target.value)}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </label>
      <label>
        Confirmation
        <input
          type="password"
          value={confirmation}
          onChange={(event) => onConfirmation(event.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
      <p className="auth__hint" aria-live="polite">
        {problem ?? `${MIN_PASSWORD_LENGTH} caractères au moins.`}
      </p>
    </>
  );
}
