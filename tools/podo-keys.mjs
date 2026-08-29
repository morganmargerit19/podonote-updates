// Chargement des clés privées Studio Margerit — jamais affichées, jamais écrites sur disque.
//
// Deux clés, deux rôles (séparation voulue par l'audit 2026-06-12) :
//   licence : signe les clés de licence          → clé publique 4BtFnPd… (app/license.py)
//   update  : signe les manifests de mise à jour → clé publique RI6Cmxk… (app/updater.py)
//
// Trois sources, essayées dans cet ordre : variable d'environnement, trousseau
// macOS, puis fichier .env. La première valeur qui correspond à la clé publique
// embarquée dans l'app l'emporte — une valeur périmée dans une source n'empêche
// donc pas une valeur correcte ailleurs de servir.
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUB_LICENCE = '4BtFnPdW+EjMlukFYI+xUa4oPKBurvDV566V0sWsB7g=';
export const PUB_UPDATE = 'RI6CmxkEeCfzGBhzuetQ6P+ariJnJUsx1HxmM7QWDJ4=';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CHEMIN_ENV = process.env.PODONOTE_ENV || join(RACINE, '.env');

const SPEC = {
  licence: { env: 'PODONOTE_LICENSE_KEY_B64', service: 'podonote-license-key', pub: PUB_LICENCE },
  update: {
    env: 'PODONOTE_SIGN_KEY_B64', service: 'podonote-sign-key', pub: PUB_UPDATE,
    passEnv: 'PODONOTE_SIGN_PASSPHRASE', passService: 'podonote-sign-passphrase',
  },
};

function keychain(service) {
  try {
    return execFileSync('security', ['find-generic-password', '-w', '-s', service], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch { return ''; }
}

/** Lit un .env simple : une ligne NOM=valeur, guillemets optionnels, # en commentaire. */
export function lireEnv(chemin = CHEMIN_ENV) {
  if (!existsSync(chemin)) return {};
  const out = {};
  for (const ligne of readFileSync(chemin, 'utf8').split(/\r?\n/)) {
    const m = ligne.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v.trim();
  }
  return out;
}

// Sources d'une variable, dans l'ordre de préférence, avec l'origine pour les messages.
function candidats(nomEnv, service) {
  const env = lireEnv();
  return [
    { valeur: (process.env[nomEnv] || '').trim(), origine: `la variable ${nomEnv}` },
    { valeur: service ? keychain(service) : '', origine: `le trousseau (« ${service} »)` },
    { valeur: (env[nomEnv] || '').trim(), origine: `le fichier ${CHEMIN_ENV}` },
  ].filter((c) => c.valeur);
}

export function publicKeyOf(key) {
  return createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64');
}

function ouvrir(b64, passphrases) {
  const pem = Buffer.from(b64, 'base64').toString('utf8');
  if (!pem.startsWith('-----BEGIN')) throw new Error('ce n\'est pas un PEM encodé en base64');
  if (!passphrases) return createPrivateKey({ key: pem });
  let derniere;
  for (const p of passphrases) {
    try { return createPrivateKey({ key: pem, passphrase: p.valeur }); }
    catch (e) { derniere = e; }
  }
  throw new Error(passphrases.length ? 'passphrase erronée' : 'passphrase manquante', { cause: derniere });
}

/** Renvoie la clé privée demandée, après contrôle qu'elle correspond à la clé publique de l'app. */
export function loadKey(role) {
  const spec = SPEC[role];
  const cles = candidats(spec.env, spec.service);
  if (!cles.length) {
    throw new Error(
      `Clé « ${role} » introuvable. Cherchée dans : la variable ${spec.env}, ` +
      `le trousseau (« ${spec.service} ») et ${CHEMIN_ENV}.\n` +
      `Voir tools/README.md § Les clés de signature.`);
  }
  const passes = spec.passEnv ? candidats(spec.passEnv, spec.passService) : null;
  if (spec.passEnv && !passes.length) {
    throw new Error(
      `Passphrase de la clé « ${role} » introuvable. Cherchée dans : la variable ${spec.passEnv}, ` +
      `le trousseau (« ${spec.passService} ») et ${CHEMIN_ENV}.`);
  }

  const echecs = [];
  for (const c of cles) {
    let key;
    try { key = ouvrir(c.valeur, passes); }
    catch (e) { echecs.push(`  ${c.origine} : ${e.message}`); continue; }
    const pub = publicKeyOf(key);
    if (pub === spec.pub) return key;
    echecs.push(`  ${c.origine} : correspond à ${pub}, pas à la clé publique de l'app`);
  }
  throw new Error(
    `Aucune clé « ${role} » exploitable — attendue : ${spec.pub}\n${echecs.join('\n')}\n` +
    `Les clés émises depuis ces valeurs seraient rejetées par tous les postes ; rien n'a été signé.`);
}

export const b64u = (b) => Buffer.from(b).toString('base64url');
