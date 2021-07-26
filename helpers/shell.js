// var process = require('child_process')
const { spawn } = require('child_process')
const scriptsFolder = require('config').get('folders.scripts')
const tempFolder = require('config').get('folders.temp')
const moment = require('moment')

const inject = (item, data) => {

    if (item.indexOf(':scripts-folder') !== -1) {
        item = item.replace(':scripts-folder', scriptsFolder)
    }

    if (item.indexOf(':source-file') !== -1) {
        item = item.replace(':source-file', data.file.path)
    }

    if (item.indexOf(':output-folder') !== -1) {
        item = item.replace(':output-folder', tempFolder)
    }

    if (item.indexOf(':time')) {
        item = item.replace(':time', moment().format('YYYY-MM-DD-HH-mm-ss'))
    }

    return item
}

exports.run = async (file, config, context) => {

    // let data = task.data.target.
    cmd = config.cmd || ''
    if (cmd) {
        cmd = inject(cmd, {})
    }

    params = config.params || []
    params = params.map((param) => {
        param = inject(param, {})
        return param
    })

    source = config.source || '';
    if (source) {
        source = inject(source, { file })
        params.push(source)
    }

    target = config.target || '';
    if (target) {
        target = inject(target, {});
        params.push(target)
    }

    options = config.options || {}

    const logger = context.logger.start('shell')

    return new Promise((resolve, reject) => {
        // let result = process.execSync(cmd, options)

        let errored = false

        options.stdio = 'inherit'

        const child = spawn(cmd, params, options)
        // child.stdout.setEncoding('utf8')
        // child.stderr.setEncoding('utf8')

        // child.stdout.on('data', data => {
        //     logger.debug(data)
        // })

        // child.stderr.on('data', data => {
        //     logger.debug(data.toString())
        // })

        child.on('error', (error) => {
            logger.error(error)
            reject(error)
            errored = true
        })

        child.on('close', code => {
            logger.info(`exited with code ${code}`)
            logger.end()
            if (!errored) {
                resolve({ path: target })
            }
        })
    })
}
