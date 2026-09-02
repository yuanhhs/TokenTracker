const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  readCanonicalVersion,
  collectVersionEntries,
  syncVersions,
  findVersionMismatches,
} = require('../scripts/version-files.cjs');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tokentracker-version-sync-'));
  fs.mkdirSync(path.join(root, 'TokenTrackerWin'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'tokentracker-cli', version: '2.3.4' }, null, 2),
  );
  fs.writeFileSync(
    path.join(root, 'TokenTrackerWin', 'TokenTrackerWin.csproj'),
    '<Project><PropertyGroup><Version>0.0.1</Version></PropertyGroup></Project>',
  );
  return root;
}

test('syncVersions updates the Windows app from package.json', (t) => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const version = readCanonicalVersion(root);
  assert.deepEqual(syncVersions(root, version), ['TokenTrackerWin/TokenTrackerWin.csproj']);
  assert.deepEqual(findVersionMismatches(root, version), []);
  assert.equal(collectVersionEntries(root).length, 2);
});

test('validation reports a stale Windows version without modifying files', (t) => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const csproj = path.join(root, 'TokenTrackerWin', 'TokenTrackerWin.csproj');
  const before = fs.readFileSync(csproj, 'utf8');

  assert.deepEqual(findVersionMismatches(root, '2.3.4'), [
    {
      label: 'TokenTrackerWin/TokenTrackerWin.csproj',
      expected: '2.3.4',
      actual: '0.0.1',
    },
  ]);
  assert.equal(fs.readFileSync(csproj, 'utf8'), before);
});

test('Windows project must contain exactly one Version element', (t) => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const csproj = path.join(root, 'TokenTrackerWin', 'TokenTrackerWin.csproj');
  fs.writeFileSync(csproj, '<Project><Version>1.0.0</Version><Version>2.0.0</Version></Project>');
  assert.throws(() => collectVersionEntries(root), /exactly one <Version>/);
});
