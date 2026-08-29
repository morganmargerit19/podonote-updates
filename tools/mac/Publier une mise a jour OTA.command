#!/bin/bash
# Double-cliquez ce fichier dans le Finder : tout se passe en fenêtres,
# il n'y a rien à taper.
set -uo pipefail
source "$(cd "$(dirname "$0")" && pwd)/_commun.sh"
cd "$RACINE"

verifier_prerequis
verifier_cles

# Le dépôt doit être à jour, sinon on republierait par-dessus une version
# poussée depuis ailleurs.
if ! git pull --ff-only >/dev/null 2>&1; then
  dialogue_confirmer "Impossible de mettre le dossier à jour depuis GitHub (pas de réseau, ou des modifications locales en attente).

Publier quand même avec ce que contient le dossier ?" "Publier" || exit 0
fi

zip=$(choisir_zip "Choisissez le paquet de mise à jour (.zip) produit par le dépôt PodoNote")
[ -z "$zip" ] && exit 0

# Version déduite du nom du fichier, toujours soumise à confirmation.
version=$(basename "$zip" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
version=$(dialogue_texte "Numéro de version à publier :" "$version")

notes=$(dialogue_texte "Titre de la mise à jour, tel qu'il s'affichera dans l'app :" "Diktae $version")

args=(--zip "$zip" --version "$version" --notes "$notes")
if dialogue_confirmer "Joindre un fichier de notes de version (NOTES.md) à la release ?" "Choisir un fichier"; then
  notesfile=$(choisir_notes "Choisissez le fichier de notes")
  [ -n "$notesfile" ] && args+=(--notes-file "$notesfile")
fi

# Essai d'abord : il calcule et signe sans rien écrire, ce qui permet de faire
# relire les empreintes avant que quoi que ce soit ne parte.
resume=$(node tools/podo-release.mjs "${args[@]}" --essai 2>&1) \
  || dialogue_erreur "La mise à jour n'a pas passé les contrôles :

$resume"

dialogue_confirmer "$resume

Publier maintenant ? Les postes installeront cette version à leur prochaine vérification." "Publier" || exit 0

sortie=$(node tools/podo-release.mjs "${args[@]}" 2>&1) \
  || dialogue_erreur "La publication a échoué :

$sortie"

dialogue_info "Diktae $version est publié.

$sortie"
