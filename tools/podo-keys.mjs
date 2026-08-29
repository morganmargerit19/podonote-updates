// Chargement des clés privées Studio Margerit — jamais affichées, jamais écrites sur disque.
//
// Deux clés, deux rôles (séparation voulue par l'audit 2026-06-12) :
//   licence : signe les clés de licence          → clé publique 4BtFnPd… (app/license.py)
//   update  : signe les manifests de mise à jour → clé publique RI6Cmxk… (app/updater.py)
//
// Ordre de recherche : variable d'environnement, puis trousseau macOS.
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const PUB_LICENCE = '4BtFnPdW+EjMlukFYI+xUa4oPKBurvDV566V0sWsB7g=';
export const PUB_UPDATE = 'RI6CmxkEeCfzGBhzuetQ6P+ariJnJUsx1HxmM7QWDJ4=';

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

const fromEnvOrKeychain = (env, service) => (process.env[env] || '').trim() || keychain(service);

export function publicKeyOf(key) {
  return createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64');
}

/** Renvoie la clé privée demandée, après contrôle qu'elle correspond bien à la clé publique embarquée. */
export function loadKey(role) {
  const spec = SPEC[role];
  const b64 = fromEnvOrKeychain(spec.env, spec.service);
  if (!b64) {
    throw new Error(
      `Clé « ${role} » introuvable : ni $${spec.env}, ni le trousseau (service « ${spec.service} »).\n` +
      `Voir tools/README.md § Installation sur le Mac.`);
  }
  const pem = Buffer.from(b64, 'base64').toString('utf8');
  if (!pem.startsWith('-----BEGIN')) throw new Error(`La clé « ${role} » n'est pas un PEM encodé en base64.`);

  const opts = { key: pem };
  if (spec.passEnv) {
    const pass = fromEnvOrKeychain(spec.passEnv, spec.passService);
    if (!pass) throw new Error(`Passphrase manquante : ni $${spec.passEnv}, ni le trousseau (« ${spec.passService} »).`);
    opts.passphrase = pass;
  }
  let key;
  try { key = createPrivateKey(opts); }
  catch (e) { throw new Error(`Clé « ${role} » illisible (passphrase erronée ?) : ${e.message}`); }

  const pub = publicKeyOf(key);
  if (pub !== spec.pub) {
    throw new Error(
      `La clé « ${role} » ne correspond pas à la clé publique embarquée dans l'app.\n` +
      `  attendue : ${spec.pub}\n  trouvée  : ${pub}\n` +
      `Les clés émises seraient rejetées par tous les postes — rien n'a été signé.`);
  }
  return key;
}

export const b64u = (b) => Buffer.from(b).toString('base64url');
