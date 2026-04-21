import fs from 'node:fs'
import path from 'node:path'

const deploymentFile =
  process.env.CONTRACT_DEPLOYMENT_FILE || '/shared/deployments/docker.json'

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function waitForDeployment() {
  for (;;) {
    if (fs.existsSync(deploymentFile)) {
      const raw = fs.readFileSync(deploymentFile, 'utf8')
      const parsed = JSON.parse(raw)

      if (parsed.contractAddress) {
        process.env.CONTRACT_ADDRESS = parsed.contractAddress
        return
      }
    }

    console.log(`Waiting for contract deployment at ${deploymentFile}`)
    await sleep(3000)
  }
}

await waitForDeployment()
await import(path.resolve('./src/index.js'))
