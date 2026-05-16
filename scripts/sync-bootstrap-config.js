const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const source = path.join(root, 'cloudbase', 'configs', 'bootstrap.default.json')
const target = path.join(root, 'cloudfunctions', 'bootstrap', 'bootstrap.default.json')

fs.copyFileSync(source, target)
console.log(`synced ${path.relative(root, source)} -> ${path.relative(root, target)}`)
