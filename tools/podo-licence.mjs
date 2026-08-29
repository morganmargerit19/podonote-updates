#!/usr/bin/env node
// Émission d'une clé de licence PodoNote / Diktae.
//
//   node tools/podo-licence.mjs --titulaire "Nico" --jours 20 --formule essai
//   node tools/podo-licence.mjs --titulaire "Cabinet X" --formule annuel --jours 365
//   node tools/podo-licence.mjs --titulaire "Nico" --jours 30 --machine DKT-1A2B-…  (clé liée à un poste)
//   … --copier   met la clé dans le presse-papiers, prête à coller dans un message
//
// Format produit : « <base64url(payload)>.<base64url(signature Ed25519)> », exactement
// ce qu'attend app/license.py. La charge utile compacte (1 octet de format, 1 octet de
// formule, 4 octets d'expiration en jours unix, puis le titulaire) tient le jeton court ;
// le binding machine bascule sur la charge utile JSON héritée, seule à porter ce champ.
import { sign, verify, createPublicKey } from 'node:crypto';
import { loadKey, b64u, PUB_LICENCE } from './podo-keys.mjs';

const PLANS = { mensuel: 0, annuel: 1, dev: 2, essai: 3, trimestriel: 4 };
const JOUR = 86400;
const FMT_COMPACT = 2;

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) throw new Error(`Argument inattendu : ${argv[i]}`);
    const k = argv[i].slice(2);
    // Drapeau sans valeur (--copier) ou option valuée (--jours 20).
    if (argv[i + 1] && !argv[i + 1].startsWith('--')) { o[k] = argv[++i]; } else { o[k] = true; }
  }
  return o;
}

const a = args(process.argv.slice(2));
const titulaire = a.titulaire ?? a.licensee;
const jours = Number(a.jours ?? a.days);
const formule = (a.formule ?? a.plan ?? 'essai').toLowerCase();

if (!titulaire || !Number.isInteger(jours) || jours <= 0) {
  console.error('Usage : node tools/podo-licence.mjs --titulaire "Nom" --jours 20 [--formule essai] [--machine DKT-…]');
  console.error(`Formules : ${Object.keys(PLANS).join(', ')}`);
  process.exit(2);
}
if (!(formule in PLANS)) throw new Error(`Formule inconnue : ${formule} (attendu : ${Object.keys(PLANS).join(', ')})`);

const key = loadKey('licence');
const exp = Math.floor(Date.now() / 1000) + jours * JOUR;
const expJours = Math.floor(exp / JOUR); // l'app arrondit l'expiration au jour UTC

let payload;
if (a.machine) {
  // Identifiant machine : l'app ignore préfixe et tirets de la présentation « DKT-… ».
  const machine = a.machine.replace(/^DKT-/i, '').replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{16}$/.test(machine)) throw new Error(`Identifiant machine invalide : ${a.machine} (16 caractères hexadécimaux attendus)`);
  payload = b64u(Buffer.from(JSON.stringify({
    licensee: titulaire, plan: formule, iat: Math.floor(Date.now() / 1000), exp: expJours * JOUR, machine,
  }), 'utf8'));
} else {
  const h = Buffer.alloc(4);
  h.writeUInt32BE(expJours);
  payload = b64u(Buffer.concat([Buffer.from([FMT_COMPACT, PLANS[formule]]), h, Buffer.from(titulaire, 'utf8')]));
}

const token = `${payload}.${b64u(sign(null, Buffer.from(payload, 'ascii'), key))}`;

// Contrôle final avec la clé PUBLIQUE embarquée dans l'app : ce que l'on remet au
// client est exactement ce que verify_token() acceptera.
const pub = createPublicKey({
  key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(PUB_LICENCE, 'base64')]),
  format: 'der', type: 'spki',
});
if (!verify(null, Buffer.from(payload, 'ascii'), pub, Buffer.from(token.split('.')[1], 'base64url'))) {
  throw new Error('Vérification de la signature échouée — clé NON émise.');
}

if (a.copier) {
  const { execFileSync } = await import('node:child_process');
  try { execFileSync('pbcopy', { input: token }); }
  catch { console.error('(presse-papiers indisponible — copiez la clé à la main)'); }
}

const fin = new Date(expJours * JOUR * 1000).toISOString().slice(0, 10);
const grace = new Date((expJours * JOUR + 7 * JOUR) * 1000).toISOString().slice(0, 10);
console.log(token);
console.log();
console.log(`titulaire : ${titulaire}`);
console.log(`formule   : ${formule}${a.machine ? '  (liée à un poste)' : ''}`);
console.log(`expire le : ${fin}   —   blocage après la période de grâce le ${grace}`);
