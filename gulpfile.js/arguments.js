const GulpError = require('plugin-error')
const {
    getGitHash,
    codeVersions, previousVersion, getGitHashForTag, strictEnvironment,
} = require('./utils')

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
    if (strictEnvironment()) {
        if (!VALID_ENVIRONMENT_ARGS.some(env => env === environment)) {
            throw new GulpError('deploy', new Error('Error: argument there must be a valid environment: --development, or --production.'))
        }
    }
    return environment
}

const parseBump = (args) => {
    // for production deploy, a semver bump can be given, '--bump=patch' is the default.
    let semver = undefined
    const bump = args.find(arg => arg.startsWith('--bump='))
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

const parseDeployArguments = async (argv) => {
    const args = argv.slice(2) // remove first two elements

    const environment = parseEnvironment(args)
    let semver = parseBump(args)
    let tag = parseVersion(args)
    const numberBack = parseRollback(args)
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

    return { environment, semver, hash, given: givenArgs.toString().replaceAll(',',' ') }
}

module.exports = {
    parseDeployArguments,
    DEFAULT_SEMVER_CHANGE,
}
