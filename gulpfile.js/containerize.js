/* eslint-disable  no-undef, no-console */
const { series } = require('gulp')
const { containerImageNameForAPI, spawner, setContainerName, tagRef, containerTag, setGitUser, pushTags } = require('./utils')

const container = async () => {
    setContainerName()
    console.log(`Composing images for: ${containerTag()}`)
    await spawner('docker-compose build')
}

const containerPublish = async () => {
    await spawner('docker-compose push')
    await setGitUser()
    tagRef(containerTag(), process.env.REPO_HASH)
    await pushTags()
}

const containerDelete = async (which) => {
    const { image, tag } = containerImageNameForAPI(which)
    await spawner(`curl "https://${process.env.DOCKER_HUB_USER}:${process.env.DOCKER_HUB_TOKEN}` +
        `@hub.docker.com/v2/repositories/${image}/tags/${tag}/" -X DELETE`)
}

const containerize = series(containerBuild, containerCompose, containerPublish)

module.exports = {
    container, containerize, containerBuild, containerCompose, containerDelete, containerPublish
}
