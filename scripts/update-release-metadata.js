/**
 * =============================================================================
 * scripts/update-release-metadata.js
 * =============================================================================
 * Régénère dist/Antigravite.Setup.<version>.exe.blockmap et dist/latest.yml
 * à partir de l'installateur final (après signature numérique par SignPath.io).
 *
 * Garantit qu'electron-updater dispose de la taille exacte et du hash SHA-512
 * correspondant au binaire signé (zéro erreur "sha512 checksum mismatch").
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

async function computeSha512Base64(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha512');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('base64')));
    stream.on('error', reject);
  });
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  const version = process.env.RELEASE_VERSION || pkg.version;
  const productName = (pkg.build && pkg.build.productName) || 'Antigravite';
  const distDir = path.join(rootDir, (pkg.build && pkg.build.directories && pkg.build.directories.output) || 'dist');

  const installerName = `${productName}.Setup.${version}.exe`;
  const installerPath = path.join(distDir, installerName);
  const blockmapPath = `${installerPath}.blockmap`;
  const latestYmlPath = path.join(distDir, 'latest.yml');

  if (!fs.existsSync(installerPath)) {
    throw new Error(`Installateur introuvable : ${installerPath}`);
  }

  const stats = fs.statSync(installerPath);
  const size = stats.size;
  let sha512 = await computeSha512Base64(installerPath);

  // Régénération du .blockmap pour le binaire signé via le moteur d'electron-builder
  try {
    const { buildBlockMap } = require('app-builder-lib/out/targets/blockmap/blockmap');
    const bmInfo = await buildBlockMap(installerPath, 'gzip', blockmapPath);
    if (bmInfo && bmInfo.sha512) {
      sha512 = bmInfo.sha512;
    }
    console.log(`[Metadata] Blockmap régénéré : ${blockmapPath}`);
  } catch (err) {
    console.warn(`[Metadata] Avertissement génération blockmap (${err.message}). Poursuite avec SHA-512 direct.`);
  }

  const releaseDate = new Date().toISOString();
  const yamlContent = [
    `version: ${version}`,
    `files:`,
    `  - url: ${installerName}`,
    `    sha512: ${sha512}`,
    `    size: ${size}`,
    `path: ${installerName}`,
    `sha512: ${sha512}`,
    `releaseDate: '${releaseDate}'`,
    ``
  ].join('\n');

  fs.writeFileSync(latestYmlPath, yamlContent, 'utf8');

  console.log(`[Metadata] latest.yml mis à jour avec succès :`);
  console.log(`  - Fichier : ${installerName}`);
  console.log(`  - Taille  : ${size} octets`);
  console.log(`  - SHA-512 : ${sha512}`);
}

main().catch((err) => {
  console.error('[Metadata] Erreur critique :', err);
  process.exit(1);
});
