# spamTools

Monorepo pnpm — React + API Node + TypeScript, architecture DDD.

```
apps/
  api/                  API HTTP (Fastify) — racine de composition des packages métier
  web/                  Interface React (Vite), appelle l'API
packages/
  shared-kernel/        Briques DDD communes (Entity, ValueObject, AggregateRoot, UseCase...)
  database/             Gestion BDD : connexion, migrations
  data-import/          Import de données : sources, suivi des imports
  card-catalog/         Catalogue des cartes : modèle, synchro depuis spamgame.com, consultation
```

## Couches (dans chaque package)

| Couche            | Contenu                                         | Peut dépendre de          |
|-------------------|-------------------------------------------------|---------------------------|
| `domain/`         | Entités, value objects, règles métier           | `shared-kernel` uniquement |
| `application/`    | Cas d'utilisation + **ports** (interfaces)      | `domain/`                 |
| `infrastructure/` | **Adaptateurs** techniques implémentant les ports | `application/`, `domain/`, libs externes |

- L'entrée principale d'un package (`@spamtools/xxx`) n'expose que `domain` + `application`.
- L'infrastructure est exposée séparément (`@spamtools/xxx/infrastructure`) et ne doit être
  importée que par la racine de composition (`apps/api/src/container.ts`).
- Aucun package ne dépend d'un autre package métier : c'est l'app qui les relie via les ports
  (ex. `RecordSink` de `data-import` sera implémenté avec `database`).

## apps/api

- `container.ts` : racine de composition (branche les adaptateurs sur les ports).
- `http/` : adaptateurs entrants (routes HTTP → cas d'utilisation).
- `adapters/` : adaptateurs sortants propres à l'app.

## apps/web (React)

Même séparation, côté front :

| Dossier           | Contenu                                                    |
|-------------------|------------------------------------------------------------|
| `domain/`         | Types et règles métier — TS pur, sans React ni `fetch`     |
| `application/`    | Ports (ex. `ImportGateway`)                                |
| `infrastructure/` | Adaptateurs (ex. `HttpImportGateway` qui appelle l'API)    |
| `ui/`             | Composants React ; récupèrent les ports via `useGateways()` |
| `main.tsx`        | Racine de composition du front                             |

Le front ne dépend pas des packages métier : il parle à l'API via ses propres types.

## Commandes

```sh
nvm use        # Node 26.11.1
pnpm install
pnpm dev       # tsc en watch + API (port 3000) + Vite (http://localhost:5173)
pnpm build     # build de tous les packages et apps
pnpm typecheck
pnpm --filter @spamtools/card-catalog test   # tests (node:test)
```

## Données des cartes

Source : fichiers publiés par l'éditeur sur `https://spamgame.com/data/` (pas de scraping).
Utilisation soumise aux [conditions d'utilisation des données](https://spamgame.com/conditions-donnees-cartes) :
projet non commercial, **artiste crédité** sur chaque illustration affichée, **mention « projet non officiel »**,
pas de logo du jeu.
