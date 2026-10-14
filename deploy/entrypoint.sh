#!/bin/sh
# Point d'entrée de l'image :
#   spamtools serve            démarre l'application (par défaut)
#   spamtools sync [options]   importe les cartes depuis spamgame.com (ex. sync --all)
#   spamtools hash-password    empreinte du mot de passe lu sur l'entrée standard
set -e
cd /app
case "${1:-serve}" in
  serve) exec node apps/api/dist/main.js ;;
  sync) shift; exec node apps/api/dist/cli/sync.js "$@" ;;
  hash-password) exec node apps/api/dist/cli/hashPassword.js ;;
  *) exec "$@" ;;
esac
