const GulpError = require('plugin-error')
const {
    getGitHash,
    codeVersions, previousVersion, getGitHashForTag, lastVersion, nextVersion, setGitUser, tagRef, pushTags,
    containerTag, setContainerName, tagExists, fetchTags,
} = require('./utils')
const { postDeployTests } = require('./tests')
const { apply } = require('./apply');

const DEFAULT_ENVIRONMENT = 'development'
const VALID_ENVIRONMENT_ARGS = [DEFAULT_ENVIRONMENT, 'production']
const DEFAULT_SEMVER_CHANGE = 'patch'
const VALID_SEMVER_CHANGE_ARG = [DEFAULT_SEMVER_CHANGE, 'minor', 'major']

const parseEnvironment = (args) => {
    // Get the environment to deploy to and the project in google that corresponds to this environment.
    let environment = args.find(arg => arg.startsWith('--environment='))
    if (environment) {
        environment = environment.substring(14)
    }
    if (!environment) {
        environment = VALID_ENVIRONMENT_ARGS.find(env => args.some(arg => env === arg.substring(2))) || DEFAULT_ENVIRONMENT
    }
    if (!VALID_ENVIRONMENT_ARGS.some(env => env === environment)) {
        throw new GulpError('deploy', new Error('Error: argument there must be a valid environment: --development, or --production.'))
    }
    return environment
}

const parseBump = (args) => {
    // for production deploy, a semver bump can be given, '--bump=patch' is the default.
    let semver
    let bump = args.find(arg => arg.startsWith('--bump='))
    if (bump) {
        semver = bump.substring(7)
        if (!VALID_SEMVER_CHANGE_ARG.some(sem => sem === semver)) {
            throw new GulpError('deploy', new Error('Error: for --bump, a valid semantic version increment must be given: --patch, --minor or --major.'))
        }
    }
    return semver
}

const parseVersion = (args) => {
    let tag = args.find(arg => arg.startsWith('--version='))
    if (tag) {
        tag = `version/${tag.substring(10)}`
    }
    return tag
}

const parseRollback = (args) => {
    let numberBack = args.find(arg => arg.startsWith('--rollback='))
    if (numberBack) {
        numberBack = numberBack.substring(11)
    }
    return numberBack
}

const parseHash = (args) => {
    let hash = args.find(arg => arg.startsWith('--hash='))
    if (hash) {
        hash = hash.length > 14 ? hash.substring(7).slice(0,7) : hash.substring(7)
        if (hash.length !== 7) {
            throw new GulpError('deploy', new Error('Error: Hash must be 7 or more digits'))
        }
    }
    return hash
}

const parseArguments = async (argv) => {
    const args = argv.slice(2) // remove first two elements

    let environment = parseEnvironment(args)
    let semver = parseBump(args)
    let tag = parseVersion(args)
    let numberBack = parseRollback(args)
    let hash = parseHash(args)

    const givenArgs = [numberBack?`--rollback=${numberBack}`:undefined, tag, semver?`--bump=${semver}` : undefined, hash? `hash=${hash}`: undefined].filter(Boolean)
    if (!givenArgs.length) {
        semver = environment==='production'?DEFAULT_SEMVER_CHANGE:'none'
        givenArgs.push('bump='+semver)
    }
    if (givenArgs.length !== 1) {
        throw new GulpError('deploy', new Error('Error: Only one parameter, --bump=[patch | minor | major] --rollback=# or --version=#.#.# may be given'))
    }

    if (numberBack) {
        const versions = codeVersions()
        tag = previousVersion(versions, numberBack)
        givenArgs.push('to '+tag)
    }
    if (!hash) {
        hash = tag ? getGitHashForTag(tag) : getGitHash()
    }
    return { environment, semver, hash }
}

const deploy = async () => {
    await setGitUser()
    await fetchTags()

    const { environment, semver, hash } = await parseArguments(process.argv)
    setContainerName(hash)

    console.log(`\x1b[35mDeploying org/repo:hash --> \x1b[31m'${containerTag(hash)}'\x1b[35m into environment \x1b[31m'${environment}'\x1b[35m with arguments: \x1b[31m${givenArgs.toString().replaceAll(',',' ')}\x1b[0m `)

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
            console.log(`\x1b[35mSemantic versions are only assigned to production deployments, no version tags have been generated.\x1b[0m`)
        }
    }
    await postDeployTests()
}

module.exports = {
    deploy,
}
