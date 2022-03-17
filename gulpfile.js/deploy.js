/* eslint-disable  no-undef, no-console */
const GulpError = require('plugin-error')
const {
    codeVersions, getGitHashForTag, lastVersion, nextVersion, setGitUser, tagRef, pushTags,
    containerTag, setContainerName, tagExists, fetchTags, containerImageName,
} = require('./utils')
const { postDeployTests } = require('./tests')
const { apply } = require('./apply')
const { parseDeployArguments } = require('./arguments')

const deploy = async () => {
    await setGitUser()
    await fetchTags()

    const { environment, semver, hash, given } = await parseDeployArguments(process.argv)
    setContainerName(hash)

    console.log(`\x1b[35mDeploying org/repo:hash --> \x1b[31m'${containerImageName()}'\x1b[35m into environment \x1b[31m'${environment}'\x1b[35m with arguments: \x1b[31m${given}\x1b[0m `)

    // make sure the hash has a container:
    if (!tagExists(containerTag(), hash)) {
        throw new GulpError('deploy', new Error('Error: no container image has been built for this commit, please checkout this commit and run the containerize script.'))
    }
    await apply(environment)
    if (semver) { // if this is a new deploy, not a rollback, version, or hash deploy
        if (environment === 'production') { // if this is a production deploy
            // Update the repo semver tags for production.
            const versions = codeVersions()
            const last = lastVersion(versions)
            const lastHash = getGitHashForTag(last)
            if (lastHash !== process.env.REPO_HASH) {
                const version = nextVersion(versions, semver)
                console.log(`Bump Level: \x1b[33m${semver}\x1b[0m Version: \x1b[33m${version}\x1b[0m, Last Version: \x1b[33m${last}\x1b[0m`)
                await tagRef(version, hash)
                await pushTags()
            } else {
                console.log(`\x1b[35mA tag for hash ${process.env.REPO_HASH} already exists (${last}), skipping creating and tagging of a new version\x1b[0m`)
            }
        } else { // if this is a non-production deploy
            console.log('\x1b[35mSemantic versions are only assigned to production deployments, no version tags have been generated.\x1b[0m')
        }
    }
    await postDeployTests()
}

module.exports = {
    deploy,
}
