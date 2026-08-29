# Outils Studio Margerit — licences et publication OTA depuis le Mac

## Utilisation courante : deux fichiers à double-cliquer

Dans le Finder, ouvrez `tools/mac/` et double-cliquez :

| Fichier | Ce qu'il fait |
| --- | --- |
| **Publier une mise a jour OTA.command** | choix du paquet `.zip`, récapitulatif à valider, puis release GitHub signée |
| **Emettre une licence.command** | demande le titulaire, la durée et la formule, et copie la clé dans le presse-papiers |

Tout se passe en fenêtres macOS : il n'y a rien à taper. Le premier lancement demande
les trois valeurs des clés de signature (voir plus bas), une seule fois.

La publication vous montre d'abord un récapitulatif — version, taille du paquet, empreinte
SHA-256, clé utilisée — sans avoir rien écrit ni publié. Rien ne part tant que vous n'avez
pas cliqué « Publier ».

> macOS peut demander une confirmation au tout premier double-clic d'un `.command`.
> Si le Finder refuse de l'ouvrir : clic droit sur le fichier → **Ouvrir**.

## Depuis VS Code

Ouvrez ce dossier dans VS Code : trois tâches sont déjà configurées (`.vscode/tasks.json`).

| Raccourci | Tâche |
| --- | --- |
| **Cmd+Shift+B** | Publier une mise à jour OTA |
| Cmd+Shift+P → « Tasks: Run Task » | Émettre une licence · Vérifier les clés de signature |

« Émettre une licence » demande le titulaire, la durée et la formule dans la palette de
commandes, puis copie la clé dans le presse-papiers. « Publier une mise à jour OTA » lance le
même déroulé qu'un double-clic dans le Finder : le sélecteur de fichiers et les confirmations
sont ceux de macOS, pour ne pas avoir à taper un chemin de paquet à la main.

Rien à configurer : les tâches lisent les clés dans le trousseau, comme les lanceurs.

## Préparation, une fois pour toutes

Trois choses à faire, la seule fois où le Terminal est nécessaire :

```sh
brew install node gh
```
```sh
gh auth login
```

Puis cloner ce dépôt là où vous voulez le garder. Les lanceurs vérifient ces prérequis et
vous disent quoi faire s'il en manque un.

### Les clés de signature

Deux clés distinctes depuis l'audit du 12/06/2026 — celle qui signe les licences ne signe
plus de code :

| Rôle | Clé publique correspondante, embarquée dans l'app |
| --- | --- |
| licence | `4BtFnPd…` — `app/license.py` |
| mise à jour | `RI6Cmxk…` — `app/updater.py` |

Leurs valeurs sont dans les variables d'environnement de l'environnement Claude Code
(réglages de l'environnement, sur claude.ai/code) : `PODONOTE_LICENSE_KEY_B64`,
`PODONOTE_SIGN_KEY_B64` et `PODONOTE_SIGN_PASSPHRASE`. Au premier lancement, un lanceur
les demande dans trois fenêtres à saisie masquée et les range dans le trousseau du Mac.

Une valeur mal collée est repérée tout de suite : les outils refusent de signer avec une
clé dont la publique ne correspond pas à celle de l'app, et vous proposent de recommencer
la saisie plutôt que d'émettre des jetons que les postes rejetteraient.

> **Sauvegardez les deux clés hors du Mac** (gestionnaire de mots de passe). Aucune des deux
> n'est régénérable : les postes déjà installés ne connaissent que ces clés publiques-là.
> Perdre la clé licence rend impossible toute nouvelle licence ; perdre la clé update coupe
> la distribution OTA.

## Garde-fous à la publication

Le script refuse de publier si :

- la version n'est pas strictement supérieure à celle de `publier.txt` — les postes rejettent
  les retours arrière, la release ne servirait à rien ;
- `app/` ou `requirements.txt` manquent du paquet ;
- le paquet contient un `.env`, un `.venv/`, des données patient ou un `license.json`.

Après publication, il relit `releases/latest/download/manifest.json` — l'URL que les postes
interrogent réellement — et signale l'anomalie si elle ne sert pas le manifest qui vient d'être
signé. Si la release GitHub échoue alors que le commit est déjà poussé, il affiche l'état exact
du dépôt et la commande à relancer, plutôt que de laisser deviner.

Les postes vérifient toutes les 6 heures : le déploiement n'est pas instantané.

## En ligne de commande, si besoin

Les lanceurs ne font qu'habiller ces deux scripts, utilisables directement :

```sh
node tools/podo-licence.mjs --titulaire "Nico" --jours 20 --formule essai
```

Formules : `essai`, `mensuel`, `trimestriel`, `annuel`, `dev`. L'app accorde 7 jours de grâce
après l'expiration. `--machine DKT-XXXX-XXXX-XXXX-XXXX` lie la clé à un poste unique
(identifiant affiché sur son écran Licence). `--copier` met la clé dans le presse-papiers.

```sh
node tools/podo-release.mjs --zip ~/dev/podonote/dist/podonote-app-1.1.8.zip \
                            --notes-file NOTES-1.1.8.md --essai
```

`--essai` calcule et signe sans rien écrire ni publier. Sans lui, le script dépose
`artefacts/v1.1.8/`, met à jour `publier.txt`, commite, pousse et crée la release. La version
est déduite du nom du zip ; `--version 1.1.8` la force.

Les deux scripts acceptent les variables d'environnement `PODONOTE_LICENSE_KEY_B64`,
`PODONOTE_SIGN_KEY_B64` et `PODONOTE_SIGN_PASSPHRASE`, prioritaires sur le trousseau.

Note : l'enregistrement dans le trousseau passe la valeur en argument de `security`, donc
brièvement visible dans la liste des processus du Mac. Sur un poste à utilisateur unique
c'est sans conséquence ; les clés, elles, ne sont jamais écrites sur le disque en clair.
