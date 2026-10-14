/**
 * Cas d'utilisation applicatif : orchestre le domaine via des ports,
 * sans jamais dépendre d'une implémentation technique.
 */
export interface UseCase<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}
