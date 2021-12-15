const { series } = require('gulp')
const { spawner, setContainerName, tagRef, containerTag, setGitUser } = require('./utils')

const container = async () => {
    setContainerName()
    console.log(`Composing images for: ${containerTag()}`)
    await spawner('docker-compose build')
}

const publish = async () => {
    await spawner('docker-compose push')
    await setGitUser()
    tagRef(containerTag(), process.env.REPO_HASH)
}

const containerize = series(container, publish)

module.exports = {
    container, containerize, publish
}