import type { Card } from '../../domain/Card.ts';

/** Crédit de l'illustration, requis partout où elle est affichée (conditions d'utilisation des données). */
export function ArtistCredit({ artist }: { artist: Card['artwork']['artist'] }) {
  return (
    <span className="artist-credit">
      Illustration :{' '}
      {artist.link === null ? (
        artist.name
      ) : (
        <a href={artist.link} target="_blank" rel="noreferrer noopener">
          {artist.name}
        </a>
      )}
    </span>
  );
}
