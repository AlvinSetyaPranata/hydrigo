import hre from 'hardhat'
import fs from 'node:fs'
import path from 'node:path'

async function main() {
  const factory = await hre.ethers.getContractFactory('SensorRegistry')
  const contract = await factory.deploy()
  await contract.waitForDeployment()

  const address = await contract.getAddress()
  const outputPath = path.resolve('deployments', 'docker.json')

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        contractAddress: address,
      },
      null,
      2,
    ),
  )

  console.log(`SensorRegistry deployed to ${address}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
