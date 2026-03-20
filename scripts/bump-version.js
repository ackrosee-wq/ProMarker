import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const versionPath = path.join(__dirname, '..', 'version.json');
const manifestPath = path.join(__dirname, '..', 'CSXS', 'manifest.xml');

const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
version.build++;
version.patch = version.build;

const versionString = `${version.major}.${version.minor}.${version.patch}`;

fs.writeFileSync(versionPath, JSON.stringify(version, null, 2) + '\n');

let manifest = fs.readFileSync(manifestPath, 'utf8');
manifest = manifest.replace(
  /ExtensionBundleVersion="[^"]*"/,
  `ExtensionBundleVersion="${versionString}"`
);
manifest = manifest.replace(
  /(<Extension Id="com\.promarker\.panel" Version=")[^"]*(")/,
  `$1${versionString}$2`
);
fs.writeFileSync(manifestPath, manifest);

console.log(`[ProMarker] Version bumped to ${versionString}`);
