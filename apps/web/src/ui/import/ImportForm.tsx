import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { summarize, type ImportReport } from '../../domain/ImportReport.ts';
import { useGateways } from '../GatewaysContext.tsx';

type ImportState =
  | { kind: 'idle' }
  | { kind: 'done'; report: ImportReport }
  | { kind: 'error'; message: string };

export function ImportForm() {
  const { imports } = useGateways();

  // useActionState (React 19) : gère l'état d'un formulaire soumis via `action`.
  // La fonction reçoit l'état précédent et les données du formulaire.
  const [state, formAction] = useActionState<ImportState, FormData>(async (_previous, formData) => {
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return { kind: 'error', message: 'Choisissez un fichier JSON' };
    }
    try {
      return { kind: 'done', report: await imports.importFile(file) };
    } catch (error) {
      return { kind: 'error', message: error instanceof Error ? error.message : String(error) };
    }
  }, { kind: 'idle' });

  return (
    <form action={formAction}>
      <input type="file" name="file" accept="application/json,.json" />
      <SubmitButton />

      {state.kind === 'done' && <p>{summarize(state.report)}</p>}
      {state.kind === 'error' && <p role="alert">{state.message}</p>}
    </form>
  );
}

function SubmitButton() {
  // useFormStatus lit l'état du <form> parent : pas besoin de props.
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Import en cours…' : 'Importer'}
    </button>
  );
}
