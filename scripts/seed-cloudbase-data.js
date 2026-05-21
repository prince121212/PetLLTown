const fs = require('fs')
const path = require('path')
const CloudBaseManager = require('@cloudbase/manager-node')
const cloudbase = require('@cloudbase/node-sdk')
const { loadLocalEnv } = require('./lib/load-env')

const root = path.resolve(__dirname, '..')
const args = new Set(process.argv.slice(2))
const shouldApply = args.has('--apply')
const shouldOverwriteBootstrap = args.has('--overwrite-bootstrap') || args.has('--force-bootstrap')

loadLocalEnv(root)

const envId = requiredEnv('CLOUDBASE_ENV_ID')
const secretId = requiredEnv('TENCENTCLOUD_SECRET_ID')
const secretKey = requiredEnv('TENCENTCLOUD_SECRET_KEY')
const region = process.env.CLOUDBASE_REGION || 'ap-shanghai'
const bootstrapConfig = readJson('cloudbase/configs/bootstrap.default.json')
const petManifests = readPetManifests()
const seedDocuments = [
  {
    collection: 'app_configs',
    id: 'bootstrap',
    data: {
      enabled: true,
      config: bootstrapConfig,
      updatedAt: new Date().toISOString(),
      updatedBy: 'seed-cloudbase-data',
    },
  },
  ...petManifests.map((petManifest) => ({
    collection: 'pets',
    id: petManifest.petId,
    data: {
      enabled: true,
      name: petManifest.name,
      manifest: petManifest,
      updatedAt: new Date().toISOString(),
      updatedBy: 'seed-cloudbase-data',
    },
  })),
]
const seedCollections = [
  'app_configs',
  'pets',
  'voice_logs',
  'ai_logs',
  'admin_audit_logs',
  'user_memories',
  'user_profiles',
]

const manager = CloudBaseManager.init({
  envId,
  secretId,
  secretKey,
  region,
})

const app = cloudbase.init({
  env: envId,
  secretId,
  secretKey,
  region,
})

function requiredEnv(name) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required in .env.local`)
  }

  return value
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
}

function readPetManifests() {
  const petConfigDir = path.join(root, 'cloudbase/configs/pets')

  return fs
    .readdirSync(petConfigDir)
    .filter((fileName) => fileName.endsWith('.manifest.json'))
    .map((fileName) => JSON.parse(fs.readFileSync(path.join(petConfigDir, fileName), 'utf8')))
    .filter((manifest) => manifest && typeof manifest.petId === 'string')
}

async function ensureCollection(collection) {
  const result = await manager.database.createCollectionIfNotExists(collection)

  if (result.IsCreated) {
    console.log(`created collection ${collection}`)
  } else {
    console.log(`collection ${collection} already exists`)
  }
}

async function writeDocument(document) {
  const db = app.database()
  await db.collection(document.collection).doc(document.id).set(document.data)
  console.log(`seeded ${document.collection}/${document.id}`)
}

async function documentExists(collection, id) {
  const db = app.database()

  try {
    const result = await db.collection(collection).doc(id).get()
    const data = Array.isArray(result.data) ? result.data[0] : result.data
    return Boolean(data)
  } catch (error) {
    return false
  }
}

async function main() {
  console.log(`${shouldApply ? 'seeding' : 'dry run'} CloudBase data for ${envId}`)

  for (const collection of seedCollections) {
    console.log(`- collection ${collection}`)
  }

  for (const document of seedDocuments) {
    console.log(`- document ${document.collection}/${document.id}`)
  }

  if (!shouldApply) {
    console.log('add --apply to create collections and write documents')
    console.log('existing app_configs/bootstrap is protected; add --overwrite-bootstrap only when intentionally replacing the online admin config')
    return
  }

  for (const collection of seedCollections) {
    await ensureCollection(collection)
  }

  for (const document of seedDocuments) {
    if (document.collection === 'app_configs' && document.id === 'bootstrap' && !shouldOverwriteBootstrap) {
      const exists = await documentExists(document.collection, document.id)

      if (exists) {
        console.log('skipped app_configs/bootstrap because it already exists')
        console.log('add --overwrite-bootstrap to intentionally replace the online bootstrap config')
        continue
      }
    }

    await writeDocument(document)
  }

  console.log('done')
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error)
  process.exit(1)
})
