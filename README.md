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
  collection/           Mes cartes : les cartes que possède le joueur
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
| `POST /api/decks/suggestions` | Autocomplétion `{ version, slots, damage, healWeight, turns, excludedCardIds }` |
| `GET /api/collection`, `PUT /api/collection/cards` | Cartes possédées `{ cardIds, owned }`      |

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

Bonus « par coup reçu » (Sac de frappe : +1 dans l'élément de la carte) : fourchette entre « jamais frappé »
(analyse principale) et « frappé une fois à chaque tour » (résumé, courbe en pointillés, colonne de données).

Les effets conditionnels, à usage limité ou en pourcentage de PV sont listés « non chiffrés ».
Le modèle de chaque capacité est calculé à l'import (`computeCardStats`) ; l'analyse (`analyzeDeck`) simule.

**Autocomplétion (« Compléter le deck »)** : garde les cartes déjà choisies (et leur talent s'il est choisi)
et complète le deck, DPS compris, pour maximiser dégâts^(1 − p) × soins^p, avec la mesure de dégâts au choix
(totaux ou cible unique) et p la part des soins (0 % : dégâts seuls, 100 % : soins seuls ; entre les deux,
un compromis qui exige les deux). Recherche (`searchDecks`) : construction carte par carte en gardant les
meilleurs candidats, puis remplacements successifs, dans un budget de quelques secondes ; les talents sans
effet chiffré sont fusionnés avec « aucun talent », le DPS n'est essayé que si un renfort ciblé existe.

## Mes cartes (`/collection`)

Toutes les cartes, clic gauche pour indiquer celles que l'on possède (enregistrées en base, par identifiant de
carte, stable d'une version à l'autre). « Tout sélectionner / désélectionner » agit sur les cartes affichées,
filtres compris ; « Afficher » : toutes, possédées ou manquantes. Dans le deck builder, « Uniquement mes
cartes » limite l'autocomplétion aux cartes possédées.

## Déploiement (Docker, ex. VPS OVH)

Une image unique (`Dockerfile`) : l'API Node sert aussi le front compilé. `compose.yaml` y ajoute **Caddy**,
qui obtient le certificat HTTPS (Let's Encrypt) et protège l'accès par **mot de passe** : l'application n'a
pas de comptes, sans lui n'importe qui pourrait modifier les decks et la collection. Les données (base
SQLite, images) sont dans le volume `spamtools-data`.

**Prérequis** : un serveur avec Docker et Docker Compose (Ubuntu : `curl -fsSL https://get.docker.com | sh`),
un nom de domaine dont l'enregistrement DNS A (et AAAA si IPv6) pointe vers l'IP du serveur, les ports 80
et 443 ouverts (pare-feu OVH et `ufw` le cas échéant).

```sh
git clone <dépôt> spamtools && cd spamtools
cp deploy/.env.example deploy/.env
docker run --rm caddy:2.10-alpine caddy hash-password --plaintext 'mot-de-passe'   # empreinte bcrypt
nano deploy/.env        # DOMAIN, BASIC_AUTH_USER, BASIC_AUTH_HASH (doubler chaque $ en $$)

docker compose --env-file deploy/.env up -d --build          # démarre l'app et Caddy
docker compose --env-file deploy/.env run --rm app sync --all  # première importation des cartes
```

| Tâche | Commande |
|---|---|
| Synchroniser les cartes (nouveau patch) | `docker compose --env-file deploy/.env run --rm app sync` |
| Mettre à jour l'application | `git pull && docker compose --env-file deploy/.env up -d --build` |
| Journaux | `docker compose --env-file deploy/.env logs -f app` |
| Sauvegarder les données | `docker compose --env-file deploy/.env stop app && docker run --rm -v spamtools_spamtools-data:/data -v "$PWD":/backup alpine tar czf /backup/spamtools-data.tgz -C /data . && docker compose --env-file deploy/.env start app` |

Réglages de l'image (variables d'environnement) : `PORT` (3000), `HOST` (0.0.0.0), `SPAMTOOLS_DATA_DIR`
(`/data`), `SPAMTOOLS_WEB_DIR` (front compilé, `/app/web`). Le site reste soumis aux conditions d'utilisation
des données de cartes (projet non commercial, artistes crédités, mention « non officiel »).

