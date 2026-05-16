const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const sourceDir = path.join(root, 'cloudbase', 'configs', 'pets')
const targetDir = path.join(root, 'cloudfunctions', 'getPetManifest', 'manifests')

fs.mkdirSync(targetDir, { recursive: true })

for (const fileName of fs.readdirSync(sourceDir)) {
  if (!fileName.endsWith('.manifest.json')) continue

  const source = path.join(sourceDir, fileName)
  const target = path.join(targetDir, fileName)

  fs.copyFileSync(source, target)
  console.log(`synced ${path.relative(root, source)} -> ${path.relative(root, target)}`)
}
