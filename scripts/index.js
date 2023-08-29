const fs = require('node:fs/promises')
const path = require('node:path')

const { requestPromise } = require('./request')


const request = async(url, retry = 0) => {
  return requestPromise(url).catch((err) => {
    if (++retry >= 3) throw err
    return request(url, retry)
  })
}

const pkgjsonPath = path.join(__dirname, '../package.json')

const run = async() => {
  const versionInfo = await request('https://raw.githubusercontent.com/lyswhut/lx-music-desktop/master/publish/version.json')
  // const versionInfo = await request('https://fastly.jsdelivr.net/gh/lyswhut/lx-music-desktop/publish/version.json')
  const pkgInfo = JSON.parse((await fs.readFile(pkgjsonPath)).toString())
  pkgInfo.versionInfo = versionInfo
  pkgInfo.version = JSON.parse(versionInfo).version
  await fs.writeFile(pkgjsonPath, JSON.stringify(pkgInfo, null, 2))
}

run()
