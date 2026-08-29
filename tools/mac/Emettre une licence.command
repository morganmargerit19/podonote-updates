#!/bin/bash
# Double-cliquez ce fichier dans le Finder pour créer une clé de licence.
set -uo pipefail
source "$(cd "$(dirname "$0")" && pwd)/_commun.sh"
cd "$RACINE"

command -v node >/dev/null || dialogue_erreur "Node.js est introuvable.

Ouvrez le Terminal une seule fois et lancez :
    brew install node"
verifier_cles

titulaire=$(dialogue_texte "Nom du titulaire de la licence :" "")
[ -z "$titulaire" ] && exit 0

jours=$(dialogue_texte "Durée de la licence, en jours :" "30")
formule=$(dialogue_texte "Formule (essai, mensuel, trimestriel, annuel, dev) :" "essai")

sortie=$(node tools/podo-licence.mjs --titulaire "$titulaire" --jours "$jours" --formule "$formule" 2>&1) \
  || dialogue_erreur "La clé n'a pas pu être émise :

$sortie"

cle=$(printf '%s' "$sortie" | head -1)
printf '%s' "$cle" | pbcopy

dialogue_info "Clé copiée dans le presse-papiers, prête à être collée dans un message.

$sortie"
