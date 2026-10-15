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
  identity/             Comptes : connexion (sessions), liens de mot de passe, administration
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
au plus un talent par carte (aucun par défaut), et un **DPS** facultatif. **Agrandir** affiche le deck et
son analyse sur tout l'écran (graphiques en grille), **Réduire** ou Échap revient à côté des cartes. L'analyse **simule la partie tour par tour, en espérance**,
les 4 cartes agissant à chaque tour :

- capacité de recharge N : prête pour la première fois au tour N, puis N tours après chaque utilisation
  (tour 1 : seules les recharges de 1 agissent) ; l'Écho la rejoue aussitôt, dans le même tour, avec sa
  chance (et ainsi de suite) : 1 / (1 − écho) utilisations en moyenne, talent Roulette compris ;
- AoE (passif, talent, mot-clé d'une capacité) : les cartes adjacentes à la cible reçoivent la part indiquée
  (20 / 40 / 80 %), 1,5 voisine en moyenne ; un soin de la carte ciblée par une attaque (Épine Médusine)
  soigne la carte adverse touchée et se déduit des dégâts ;
- dégâts et soins : × précision × (1 + chance de critique × (multiplicateur − 1)) ; bonus élémentaires :
  toujours obtenus en entier, sans précision ni critique (un bonus « en cas de coup critique » : × chance
  de critique) ;
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

## Comptes (`/compte`, `/admin`)

Le site se consulte **sans compte** : SpamDex, détail des cartes, composition et analyse d'un deck. Les
actions personnelles demandent une connexion : enregistrer ou ouvrir un deck, « Mes cartes », la recherche du
meilleur deck (coûteuse en calcul), les comptes. Sans compte, elles ouvrent la fenêtre « Vous devez vous
connecter pour accéder à toutes les fonctionnalités » ; la connexion (`/connexion`) s'affiche par-dessus le
site, un deck en cours n'est pas perdu. Chaque compte a ses propres decks et sa propre collection.

- **Création par un administrateur**, sans mot de passe : il reçoit un **lien d'invitation**
  (`/mot-de-passe#<jeton>`, une seule fois, 3 jours) à transmettre au titulaire, qui choisit le sien. Le jeton
  est dans le fragment de l'URL : le navigateur ne l'envoie jamais au serveur ni dans les journaux.
- **Mot de passe oublié** : l'administrateur génère un lien de réinitialisation (même principe) ; les
  sessions du compte sont fermées à son utilisation.
- **Mon compte** : changer de mot de passe (les autres sessions sont fermées), se déconnecter de tous ses
  appareils.
- **Administration** : rôle (administrateur / membre), désactivation (sessions fermées), suppression (decks
  et collection compris). Un administrateur ne modifie pas son propre compte depuis l'administration : il
  reste toujours un administrateur actif.
- **Premier administrateur**, en ligne de commande sur le serveur : `spamtools create-admin <identifiant>`
  (`pnpm --filter @spamtools/api exec node dist/cli/createAdmin.js <identifiant>` en local). Il reçoit les
  decks et la collection d'avant les comptes.

Sécurité : mots de passe de 12 caractères au moins, empreinte scrypt (`node:crypto`) ; session de 30 jours
dans un cookie `HttpOnly`, `Secure` (production), `SameSite=Strict`, dont seule l'empreinte est en base ;
modifications refusées si elles viennent d'un autre site (origine vérifiée) ; 10 tentatives par minute et
par adresse sur la connexion, les liens et le changement de mot de passe (`@fastify/rate-limit`) ; message
d'échec identique que l'identifiant existe ou non.

## Référencement

Le front est une application React : le serveur complète `index.html` pour chaque URL (`apps/api/src/http/seo.ts`)
afin que les robots qui n'exécutent pas JavaScript lisent la page :

- titre, description, URL canonique, `robots`, Open Graph et Twitter ; données structurées JSON-LD
  (`WebSite`, `WebApplication`, fil d'Ariane des cartes) ;
- une page par carte (`/?card=<slug>`) : titre « <carte> : carte <rareté> <élément> de Spam », description
  tirée de ses capacités ;
- un contenu `<noscript>` : liste des cartes (accueil), capacités, talents, histoire et artiste (carte) ;
- `/robots.txt` (pages de compte et API exclues, images autorisées) et `/sitemap.xml` (accueil, deck builder,
  chaque carte), générés depuis le catalogue ; pages de compte en `noindex`.

`SPAMTOOLS_PUBLIC_URL` donne l'adresse des URL canoniques et du sitemap. Image d'aperçu des liens partagés :
le logo du site (`apps/web/public/og-image.jpg`, 1200 × 630), jamais une illustration de carte (à créditer)
ni le logo du jeu (conditions d'utilisation des données). Logo d'origine : `design/logo-source.png`.

## Déploiement (Docker)

Une image unique (`Dockerfile`) : l'API Node sert aussi le front compilé. L'accès est géré par les comptes
(voir ci-dessus). Les données (base SQLite, images) sont dans le volume `spamtools-data`. **Démarrage automatique** : le conteneur
est en `restart: unless-stopped`, Docker le relance à chaque démarrage du serveur (`systemctl enable docker`).

L'application n'écoute que sur `SPAMTOOLS_BIND` (jamais 0.0.0.0) ; le HTTPS est assuré devant elle :

- **derrière un nginx existant** (ex. celui de mailcow) : `deploy/nginx/spamtools.conf` est le vhost à copier
  dans `/opt/mailcow-dockerized/data/conf/nginx/`, le domaine s'ajoute à `ADDITIONAL_SAN` de `mailcow.conf`
  pour le certificat, et `SPAMTOOLS_BIND` vaut l'adresse de `host.docker.internal` vue par nginx ;
- **avec Caddy** fourni (certificat automatique) : `DOMAIN` dans `deploy/.env` et `--profile caddy`.

Dans les deux cas le DNS A du domaine pointe vers l'IP publique et les ports 80/443 y sont ouverts.

```sh
git clone <dépôt> spamtools && cd spamtools
docker build -t spamtools:latest .
cp deploy/.env.example deploy/.env
nano deploy/.env        # SPAMTOOLS_PUBLIC_URL, SPAMTOOLS_BIND

docker compose --env-file deploy/.env up -d                    # (+ --profile caddy le cas échéant)
docker compose --env-file deploy/.env run --rm app sync --all  # première importation des cartes
docker compose --env-file deploy/.env run --rm app create-admin moi   # affiche le lien d'invitation
```

| Tâche | Commande |
|---|---|
| Synchroniser les cartes (nouveau patch) | `docker compose --env-file deploy/.env run --rm app sync` |
| Mettre à jour l'application | `git pull && docker compose --env-file deploy/.env up -d --build` |
| Journaux | `docker compose --env-file deploy/.env logs -f app` |
| Sauvegarder les données | `docker compose --env-file deploy/.env stop app && docker run --rm -v spamtools_spamtools-data:/data -v "$PWD":/backup alpine tar czf /backup/spamtools-data.tgz -C /data . && docker compose --env-file deploy/.env start app` |

Réglages de l'image (variables d'environnement) : `PORT` (3000), `HOST` (0.0.0.0), `SPAMTOOLS_DATA_DIR`
(`/data`), `SPAMTOOLS_WEB_DIR` (front compilé, `/app/web`), `SPAMTOOLS_TRUST_PROXY` (derrière un reverse
proxy), `SPAMTOOLS_SECURE_COOKIES` (par défaut en production), `SPAMTOOLS_PUBLIC_URL` (liens de
`create-admin`). Le site reste soumis aux conditions d'utilisation
des données de cartes (projet non commercial, artistes crédités, mention « non officiel »).

