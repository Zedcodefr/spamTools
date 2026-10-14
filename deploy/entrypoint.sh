#!/bin/sh
# Point d'entrée de l'image :
#   spamtools serve            démarre l'application (par défaut)
#   spamtools sync [options]   importe les cartes depuis spamgame.com (ex. sync --all)
set -e
cd /app
case "${1:-serve}" in
  serve) exec node apps/api/dist/main.js ;;
  sync) shift; exec node apps/api/dist/cli/sync.js "$@" ;;
  *) exec "$@" ;;
esac
