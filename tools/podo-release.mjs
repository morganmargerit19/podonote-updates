#!/usr/bin/env node
// Publication d'une mise à jour OTA de PodoNote / Diktae.
//
//   node tools/podo-release.mjs --zip ~/dev/podonote/dist/podonote-app-1.1.8.zip --notes-file ~/dev/NOTES.md
//   node tools/podo-release.mjs --zip … --version 1.1.8 --essai        (--essai : tout sauf la publication)
//
// Enchaîne : contrôles du paquet → manifest signé (clé update dédiée) → dépôt dans
// artefacts/v<version>/ → commit → release GitHub taguée v<version> portant le zip ET
// manifest.json → relecture de « releases/latest/download/manifest.json » comme le ferait
// un poste client. Les postes suivent l'URL « latest » : la release doit être la dernière
// publiée, et non un brouillon.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { sign } from 'node:crypto';
import { mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { loadKey, b64u, PUB_UPDATE } from './podo-keys.mjs';

const REPO = 'morganmargerit19/podonote-updates';
const run = (cmd, cmdArgs, opts = {}) =>
  execFileSync(cmd, cmdArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...opts }).trim();
const runRaw = (cmd, cmdArgs) =>
  execFileSync(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 });
// Sortie laissée à l'écran (gh affiche sa progression d'envoi) : execFileSync ne
// renvoie alors rien, il n'y a donc rien à lire ni à découper.
const runVisible = (cmd, cmdArgs) => { execFileSync(cmd, cmdArgs, { stdio: 'inherit' }); };

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) throw new Error(`Argument inattendu : ${argv[i]}`);
    const k = argv[i].slice(2);
    if (argv[i + 1] && !argv[i + 1].startsWith('--')) { o[k] = argv[++i]; } else { o[k] = true; }
  }
  return o;
}

const a = args(process.argv.slice(2));
const essai = Boolean(a.essai ?? a['dry-run']);
const zip = a.zip && resolve(a.zip);
if (!zip || !existsSync(zip)) {
  console.error('Usage : node tools/podo-release.mjs --zip <paquet.zip> [--version 1.1.8] [--notes-file NOTES.md] [--essai]');
  process.exit(2);
}

// Version : celle donnée, sinon celle lue dans le nom du paquet.
const version = a.version || (basename(zip).match(/(\d+\.\d+\.\d+)/) || [])[1];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Version « x.y.z » introuvable — précisez --version.`);

// Anti-retour arrière : l'app refuse toute version qui n'est pas STRICTEMENT supérieure,
// donc une release publiée sous un numéro déjà servi n'atteindrait aucun poste.
const cmp = (x, y) => {
  const p = (v) => v.split('.').map(Number);
  const [A, B] = [p(x), p(y)];
  for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return A[i] - B[i];
  return 0;
};
const publiee = existsSync('publier.txt') ? readFileSync('publier.txt', 'utf8').trim().replace(/^v/, '') : '';
if (publiee && cmp(version, publiee) <= 0) {
  throw new Error(`Version ${version} <= version publiée ${publiee} : aucun poste ne l'installerait.`);
}

// Le paquet ne doit porter que du code. Un .env ou des données embarquées partiraient
// vers tous les postes — contrôle avant signature, pas après.
const contenu = run('unzip', ['-Z1', zip]).split('\n');
const interdits = contenu.filter((f) => /(^|\/)(\.env(\.local|\.production)?|license\.json)$|(^|\/)(\.venv|donn[ée]es)\//i.test(f));
if (interdits.length) throw new Error(`Le paquet contient des fichiers à ne jamais diffuser :\n  ${interdits.slice(0, 10).join('\n  ')}`);
for (const requis of ['app/', 'requirements.txt']) {
  if (!contenu.some((f) => f.startsWith(requis))) throw new Error(`Paquet incomplet : « ${requis} » absent.`);
}

const sha256 = createHash('sha256').update(readFileSync(zip)).digest('hex');
const reqSha = createHash('sha256').update(runRaw('unzip', ['-p', zip, 'requirements.txt'])).digest('hex');

const nomZip = `podonote-app-${version}.zip`;
const url = `https://github.com/${REPO}/releases/download/v${version}/${nomZip}`;
const payloadObj = {
  version,
  url,
  sha256,
  requirements_sha256: reqSha,
  notes: a.notes || `Diktae ${version}`,
  pub_date: new Date().toISOString().slice(0, 10),
};
const payload = b64u(Buffer.from(JSON.stringify(payloadObj), 'utf8'));
const manifest = JSON.stringify(
  { payload, sig: b64u(sign(null, Buffer.from(payload, 'ascii'), loadKey('update'))) }, null, 2) + '\n';

const dossier = join('artefacts', `v${version}`);
const notesFile = a['notes-file'] && resolve(a['notes-file']);

console.log(`version  : ${version}   (précédente : ${publiee || 'aucune'})`);
console.log(`paquet   : ${nomZip}  (${(readFileSync(zip).length / 1e6).toFixed(1)} Mo)`);
console.log(`sha256   : ${sha256}`);
console.log(`manifest : signé avec la clé update ${PUB_UPDATE.slice(0, 12)}…`);
console.log(`artefacts: ${dossier}/`);

// --essai s'arrête ici, AVANT toute écriture : un essai ne doit rien laisser
// derrière lui, sans quoi un abandon en cours de route laisserait publier.txt
// annonçant une version jamais publiée.
if (essai) {
  console.log('\nEssai : rien n\'a été écrit, commité ni publié.');
  process.exit(0);
}

// Dépôt dans le dossier d'artefacts : trace de ce qui a été signé, à l'octet près.
mkdirSync(dossier, { recursive: true });
copyFileSync(zip, join(dossier, nomZip));
writeFileSync(join(dossier, 'manifest.json'), manifest);
if (notesFile) copyFileSync(notesFile, join(dossier, 'NOTES.md'));
writeFileSync('publier.txt', `v${version}\n`);

run('git', ['add', dossier, 'publier.txt']);
run('git', ['commit', '-m', `OTA Diktae ${version}`]);
run('git', ['push', '-u', 'origin', run('git', ['rev-parse', '--abbrev-ref', 'HEAD'])]);
const commit = run('git', ['rev-parse', 'HEAD']);

// --target : le tag doit désigner le commit qui vient d'être poussé. Sans lui,
// gh poserait le tag sur la tête de la branche par défaut, qui ne contient pas
// forcément ces artefacts.
const ghArgs = ['release', 'create', `v${version}`, '--repo', REPO, '--target', commit,
  '--title', `Diktae ${version}`,
  join(dossier, nomZip), join(dossier, 'manifest.json')];
ghArgs.push(...(notesFile ? ['--notes-file', notesFile] : ['--notes', payloadObj.notes]));

// Le commit est déjà poussé : si la release échoue, le dépôt annonce une version
// que les postes ne trouveront jamais. On le dit franchement plutôt que de laisser
// deviner l'état réel.
const inacheve = (quoi, e) => {
  throw new Error(
    `${quoi}\n${e.message}\n\n` +
    `ATTENTION : le commit ${commit.slice(0, 8)} est poussé et publier.txt annonce ${version}, ` +
    `mais AUCUNE release n'est publiée — les postes restent sur ${publiee || 'leur version actuelle'}.\n` +
    `Reprenez la publication avec :\n  gh release create v${version} --repo ${REPO} --target ${commit} ` +
    `--title "Diktae ${version}" ${join(dossier, nomZip)} ${join(dossier, 'manifest.json')}`);
};

try { runVisible('gh', ghArgs); }
catch (e) { inacheve('La création de la release GitHub a échoué.', e); }

// Relecture par le chemin qu'emprunte réellement un poste client.
let distant;
try { distant = run('curl', ['-fsSL', `https://github.com/${REPO}/releases/latest/download/manifest.json`]); }
catch (e) { inacheve('La release ne répond pas sur l\'URL « latest ».', e); }
if (JSON.parse(distant).payload !== payload) {
  throw new Error(
    `La release v${version} est créée, mais « latest » sert un autre manifest.\n` +
    `Vérifiez qu'aucune release plus récente ne la précède sur ${REPO}.`);
}
console.log(`\npublié : les postes verront Diktae ${version} à leur prochaine vérification (toutes les 6 h).`);
