# Fonctions communes aux raccourcis double-cliquables de tools/mac.
# Tout passe par des fenêtres macOS : rien à taper dans le Terminal.

TITRE="Studio Margerit"
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# osascript reçoit les textes en arguments plutôt que par interpolation : une
# apostrophe ou un guillemet dans un libellé ne peut pas casser le script.
_osa() { osascript "$@" 2>/dev/null; }

dialogue_info() {
  _osa - "$1" "$TITRE" <<'AS' >/dev/null
on run argv
  display dialog (item 1 of argv) buttons {"OK"} default button "OK" with title (item 2 of argv)
end run
AS
}

dialogue_erreur() {
  _osa - "$1" "$TITRE" <<'AS' >/dev/null
on run argv
  display dialog (item 1 of argv) buttons {"Fermer"} default button "Fermer" with title (item 2 of argv) with icon stop
end run
AS
  exit 1
}

# Renvoie 0 si l'utilisateur confirme, 1 s'il annule.
dialogue_confirmer() {
  local r
  r=$(_osa - "$1" "$TITRE" "${2:-Continuer}" <<'AS'
on run argv
  try
    display dialog (item 1 of argv) buttons {"Annuler", (item 3 of argv)} default button (item 3 of argv) with title (item 2 of argv)
    return "oui"
  on error
    return "non"
  end try
end run
AS
)
  [ "$r" = "oui" ]
}

# Saisie de texte. Sortie du script si l'utilisateur annule.
dialogue_texte() {
  local r
  r=$(_osa - "$1" "${2:-}" "$TITRE" <<'AS'
on run argv
  set d to display dialog (item 1 of argv) default answer (item 2 of argv) buttons {"Annuler", "OK"} default button "OK" with title (item 3 of argv)
  return text returned of d
end run
AS
)
  [ -z "$r" ] && exit 0
  printf '%s' "$r"
}

# Saisie masquée, pour les clés privées et la passphrase.
dialogue_secret() {
  _osa - "$1" "$TITRE" <<'AS'
on run argv
  set d to display dialog (item 1 of argv) default answer "" with hidden answer buttons {"Annuler", "OK"} default button "OK" with title (item 2 of argv)
  return text returned of d
end run
AS
}

choisir_zip() {
  _osa - "$1" <<'AS'
on run argv
  set f to choose file with prompt (item 1 of argv) of type {"zip"}
  return POSIX path of f
end run
AS
}

choisir_notes() {
  _osa - "$1" <<'AS'
on run argv
  set f to choose file with prompt (item 1 of argv)
  return POSIX path of f
end run
AS
}

# --------------------------------------------------------------------------- #
# Prérequis et clés
# --------------------------------------------------------------------------- #
verifier_prerequis() {
  command -v node >/dev/null || dialogue_erreur \
    "Node.js est introuvable.

Ouvrez le Terminal une seule fois et lancez :
    brew install node"
  command -v gh >/dev/null || dialogue_erreur \
    "Le client GitHub est introuvable.

Ouvrez le Terminal une seule fois et lancez :
    brew install gh"
  gh auth status >/dev/null 2>&1 || dialogue_erreur \
    "Vous n'êtes pas connecté à GitHub.

Ouvrez le Terminal une seule fois et lancez :
    gh auth login"
}

_cle_presente() { security find-generic-password -s "$1" >/dev/null 2>&1; }

# Demande une valeur et la range dans le trousseau.
_ranger_cle() {
  local service="$1" libelle="$2" valeur
  valeur=$(dialogue_secret "$libelle

La valeur se copie depuis les réglages de votre environnement sur claude.ai/code.
Elle reste masquée pendant la saisie et n'est enregistrée que dans le trousseau du Mac.")
  [ -z "$valeur" ] && exit 0
  security add-generic-password -U -a "$USER" -s "$service" -w "$valeur" >/dev/null
}

# Contrôle les clés et propose de les installer si besoin. La vérification
# porte sur la correspondance avec les clés publiques embarquées dans l'app :
# une valeur mal collée est détectée ici, pas au moment de signer.
verifier_cles() {
  local manquantes=0
  _cle_presente podonote-license-key || manquantes=1
  _cle_presente podonote-sign-key || manquantes=1
  _cle_presente podonote-sign-passphrase || manquantes=1

  if [ "$manquantes" = 1 ]; then
    dialogue_confirmer "Les clés de signature ne sont pas encore installées sur ce Mac.

Trois valeurs vous seront demandées, une par fenêtre. Elles ne sont demandées que cette fois-ci." "Installer" || exit 0
    _cle_presente podonote-license-key || _ranger_cle podonote-license-key "Clé de signature des LICENCES (PODONOTE_LICENSE_KEY_B64)"
    _cle_presente podonote-sign-key || _ranger_cle podonote-sign-key "Clé de signature des MISES À JOUR (PODONOTE_SIGN_KEY_B64)"
    _cle_presente podonote-sign-passphrase || _ranger_cle podonote-sign-passphrase "Passphrase de la clé de mise à jour (PODONOTE_SIGN_PASSPHRASE)"
  fi

  local erreur
  erreur=$(cd "$RACINE" && node -e "
    import('./tools/podo-keys.mjs').then(m => { m.loadKey('licence'); m.loadKey('update'); })
      .catch(e => { console.error(e.message); process.exit(1); })" 2>&1) && return 0

  # Valeur erronée : on retire ce qui vient d'être enregistré pour que la
  # prochaine tentative reparte d'une page blanche plutôt que d'une clé fausse.
  if dialogue_confirmer "Les clés enregistrées ne sont pas exploitables :

$erreur

Voulez-vous les saisir à nouveau ?" "Recommencer"; then
    security delete-generic-password -s podonote-license-key >/dev/null 2>&1
    security delete-generic-password -s podonote-sign-key >/dev/null 2>&1
    security delete-generic-password -s podonote-sign-passphrase >/dev/null 2>&1
    verifier_cles
  else
    exit 1
  fi
}
