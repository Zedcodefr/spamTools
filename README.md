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
  deck/                 Decks : composition (4 cartes et leur talent), enregistrement, analyse
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
| `GET/POST /api/decks`, `GET/PUT/DELETE /api/decks/:id` | Decks enregistrés                     |
| `POST /api/decks/analysis`    | Analyse d'une composition `{ version, slots, turns }`          |

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

## Deck builder (`/deck`)

Clic gauche sur une carte de la galerie : l'ajouter au deck (4 cartes, sans doublon) ou l'en retirer ;
au plus un talent par carte (aucun par défaut), et un **DPS** facultatif. L'analyse **simule la partie tour par tour, en espérance**,
les 4 cartes agissant à chaque tour :

- capacité de recharge N : prête pour la première fois au tour N, puis N tours après chaque utilisation
  (tour 1 : seules les recharges de 1 agissent) ; l'Écho la laisse prête au tour suivant avec sa chance,
  suivie en probabilité ;
- dégâts, soins et bonus élémentaires : × précision × (1 + chance de critique × (multiplicateur − 1)) ;
  « Choix » : moyenne des options ; élément aléatoire : réparti sur les 6 éléments ;
- dégâts **totaux** (toutes cibles) et **cible unique** (reçus par une carte adverse donnée) : zone = 4 cibles,
  1 part par carte ; coup au hasard parmi les 4 adverses = 1 chance sur 4 de toucher une carte donnée
  (parmi les 8 cartes du terrain : 1 sur 8, et la moitié des coups touche l'adversaire) ;
- bonus élémentaires : le stock de chaque élément gagne les générés (dès le tour où ils le sont) et perd les
  consommés (coûts) ; chaque point ajoute +10 % aux dégâts et soins de cet élément (×2 avec Multiplicateur) ;
- croissances : « la valeur de base augmente de N » (dégâts, soins ou bonus de la capacité, à chaque utilisation) ;
- renforts de précision, critique, multiplicateur de critique et dégâts/soins de base : au lanceur, à toutes
  les alliées, au **DPS choisi** (renforts ciblés ; non comptés sans DPS) ou ¼ à chaque alliée (« au hasard ») ;
  précision et critique plafonnées à 100 % ; talents « à chaque tour » appliqués à chaque tour ;
- résistances moyennes des 4 cartes, talents permanents et bonus d'équipe compris ; faiblesse = la plus basse.

Résultats en graphiques (SVG maison, couleurs validées pour les daltonismes contre le fond de l'app) :
dégâts et soins par tour en barres (ce tour précis) superposées à leur cumul en courbe, partant de 0
(« Départ », avant l'application des talents) ; les données restent consultables en tableaux.

Les effets conditionnels, à usage limité ou en pourcentage de PV sont listés « non chiffrés ».
Le modèle de chaque capacité est calculé à l'import (`computeCardStats`) ; l'analyse (`analyzeDeck`) simule.
