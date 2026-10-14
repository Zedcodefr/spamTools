# spamTools

Monorepo pnpm — React + API Node + TypeScript, architecture DDD.

```
apps/
  api/                  API HTTP (Fastify) — racine de composition des packages métier
  web/                  Interface React (Vite), appelle l'API
packages/
  shared-kernel/        Briques DDD communes (Entity, ValueObject, AggregateRoot, UseCase...)
  database/             Gestion BDD : connexion, migrations
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
  (ex. le port `CatalogRepository` de `card-catalog` est implémenté dans `apps/api` avec `database`).

## apps/api

- `container.ts` : racine de composition (branche les adaptateurs sur les ports).
- `http/` : adaptateurs entrants (routes HTTP → cas d'utilisation).
- `adapters/` : adaptateurs sortants propres à l'app.
- `cli/` : commandes en ligne (`pnpm sync`).
- `migrations.ts` : schéma de la base SQLite.

Routes (lecture seule ; sans `version`, la plus récente importée est servie) :

| Route                         | Contenu                                                        |
|-------------------------------|----------------------------------------------------------------|
| `GET /api/catalog?version=`   | Version, versions importées, éléments, raretés, mots-clés      |
| `GET /api/cards?version=&element=&rarity=&q=` | Cartes filtrées (`q` : nom et textes, sans accents) |
| `GET /api/cards/:id?version=` | Une carte                                                      |
| `GET /api/card-layout`        | Plan de rendu des cartes publié par le jeu                     |
| `GET /api/assets/<chemin>`    | Images (chemins renvoyés par les routes ci-dessus)             |

## apps/web (React)

Même séparation, côté front :

| Dossier           | Contenu                                                    |
|-------------------|------------------------------------------------------------|
| `domain/`         | Types et règles métier — TS pur, sans React ni `fetch`     |
| `application/`    | Ports (interfaces d'accès aux données)                     |
| `infrastructure/` | Adaptateurs (ex. passerelle HTTP qui appelle l'API)        |
| `ui/`             | Composants React ; récupèrent les ports via `useGateways()` |
| `main.tsx`        | Racine de composition du front                             |

Le front ne dépend pas des packages métier : il parle à l'API via ses propres types.

### Composant carte (`ui/card/`)

`<GameCard card={card} width={200} />` dessine une carte d'après le plan de rendu publié par le jeu,
avec le crédit de l'artiste dessous. Il est autonome et réutilisable dans n'importe quel outil, sous :

- `<CardEnvironmentProvider>` : plan de rendu, référentiels (éléments, raretés, mots-clés), URL des images ;
- `<CardDetailProvider>` (facultatif) : un **clic droit** sur une carte (ou la touche Menu) ouvre sa vue
  détail (talents, capacités, tox, résistances, lore). Le clic gauche reste libre pour les outils.

Les deux sont posés une fois dans `App.tsx`. La carte ouverte est reflétée dans l'URL (`?card=<slug>`).

## Commandes

```sh
nvm use        # Node 26.11.1
pnpm install
pnpm dev       # tsc en watch + API (port 3000) + Vite (http://localhost:5173)
pnpm build     # build de tous les packages et apps
pnpm typecheck
pnpm test       # tests (node:test) de tous les packages
pnpm sync       # importe la dernière version des cartes (voir ci-dessous)
```

## Données des cartes

Source : fichiers publiés par l'éditeur sur `https://spamgame.com/data/` (pas de scraping).
Utilisation soumise aux [conditions d'utilisation des données](https://spamgame.com/conditions-donnees-cartes) :
projet non commercial, **artiste crédité** sur chaque illustration affichée, **mention « projet non officiel »**,
pas de logo du jeu.

Mise à jour manuelle, en ligne de commande :

```sh
pnpm sync                    # dernière version publiée
pnpm sync --version 1.20     # une version précise
pnpm sync --all              # toutes les versions publiées
```

**Caractéristiques des cartes** (éléments de frappe, de bonus et de soin, capacités particulières et leurs
catégories) : calculées une fois à l'import par `analyzeTraits` (`packages/card-catalog/src/domain/traits/`) et
enregistrées (table `card_trait`). Le classement des capacités est dans `TraitTaxonomy.ts` ; après toute
modification des règles, incrémenter `ANALYSIS_VERSION` puis lancer `pnpm sync --all` pour recalculer.

Chaque version est conservée. Relancer la synchro ne réimporte pas une version déjà en base
et ne télécharge que les images manquantes. Les données sont dans `data/` (base `spamtools.sqlite`
et images dans `assets/`), ou dans le dossier indiqué par `SPAMTOOLS_DATA_DIR`.
