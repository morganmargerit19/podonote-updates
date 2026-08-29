# Outils Studio Margerit — licences et publication OTA depuis le Mac

Deux scripts Node, sans dépendance à installer :

| Script | Rôle | Clé utilisée |
| --- | --- | --- |
| `podo-licence.mjs` | émet une clé de licence | clé **licence** — publique `4BtFnPd…`, embarquée dans `app/license.py` |
| `podo-release.mjs` | publie une mise à jour OTA | clé **update** — publique `RI6Cmxk…`, embarquée dans `app/updater.py` |

Les deux clés sont distinctes depuis l'audit du 12/06/2026 : la clé qui signe les licences ne
doit plus signer de code. `podo-release.mjs` utilise donc la clé update dédiée, comme les
releases 1.1.x déjà publiées.

## Prérequis

```sh
brew install node gh      # Node ≥ 18 et le client GitHub
gh auth login             # accès en écriture à morganmargerit19/podonote-updates
```

## Installation des clés dans le trousseau du Mac

Les deux clés privées sont aujourd'hui dans les variables d'environnement de l'environnement
Claude Code (visibles depuis les réglages de l'environnement, sur claude.ai/code). Récupérez
leur valeur là-bas, puis rangez-la dans le trousseau macOS — les scripts la liront sans jamais
l'afficher ni l'écrire sur le disque :

```sh
# Clé de signature des LICENCES (PEM encodé en base64, valeur de PODONOTE_LICENSE_KEY_B64)
security add-generic-password -U -a "$USER" -s podonote-license-key -w

# Clé de signature des MISES À JOUR (valeur de PODONOTE_SIGN_KEY_B64) et sa passphrase
security add-generic-password -U -a "$USER" -s podonote-sign-key -w
security add-generic-password -U -a "$USER" -s podonote-sign-passphrase -w
```

Sans `-w <valeur>`, `security` demande la valeur en invite : elle ne passe pas par la ligne de
commande et n'atterrit donc pas dans l'historique du shell.

Vérification (n'affiche aucun secret) :

```sh
node -e "import('./tools/podo-keys.mjs').then(m=>{m.loadKey('licence');m.loadKey('update');console.log('clés OK')})"
```

Les scripts acceptent aussi les variables d'environnement `PODONOTE_LICENSE_KEY_B64`,
`PODONOTE_SIGN_KEY_B64` et `PODONOTE_SIGN_PASSPHRASE`, qui ont la priorité sur le trousseau.

> Sauvegardez les deux clés hors du Mac (gestionnaire de mots de passe). Perdre la clé licence
> rend impossible l'émission de toute nouvelle licence ; perdre la clé update coupe la
> distribution OTA. Ni l'une ni l'autre ne peut être régénérée : les postes déjà installés ne
> connaissent que ces clés publiques-là.

## Émettre une licence

```sh
node tools/podo-licence.mjs --titulaire "Nico" --jours 20 --formule essai
```

Formules : `essai`, `mensuel`, `trimestriel`, `annuel`, `dev`. Le script imprime la clé, la
date d'expiration et vérifie sa propre signature avec la clé publique de l'app avant de vous la
remettre. L'app accorde 7 jours de grâce après l'expiration.

Pour lier une clé à un seul poste, ajoutez `--machine DKT-XXXX-XXXX-XXXX-XXXX` (l'identifiant
affiché sur l'écran Licence du poste concerné).

## Publier une mise à jour OTA

Depuis une copie à jour de ce dépôt (`git pull`), avec le zip produit par le dépôt privé :

```sh
node tools/podo-release.mjs --zip ~/dev/podonote/dist/podonote-app-1.1.8.zip \
                            --notes-file ~/dev/podonote/NOTES-1.1.8.md --essai
```

`--essai` fait tout sauf publier : contrôles, manifest signé, fichiers écrits dans
`artefacts/v1.1.8/`. Relancez sans `--essai` pour commiter, pousser et créer la release
GitHub `v1.1.8` portant le zip et `manifest.json`.

Le script refuse de publier si la version n'est pas strictement supérieure à celle de
`publier.txt` (les postes rejettent les retours arrière), si `app/` ou `requirements.txt`
manquent, ou si le paquet contient un `.env`, un `.venv/`, des données ou un `license.json`.
Après publication il relit `releases/latest/download/manifest.json` — l'URL que les postes
interrogent réellement — et échoue si elle ne sert pas le manifest qui vient d'être signé.

La version est déduite du nom du zip ; `--version 1.1.8` la force. Les postes vérifient toutes
les 6 heures, donc le déploiement n'est pas instantané.
