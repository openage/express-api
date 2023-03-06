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

    let injectable = {
        file: file
    }

    const cmd = inject(config.cmd || '', injectable)

    const params = (config.params || []).map((param) => inject(param, injectable))

    const source = inject(config.source || '', injectable)
    if (source) {
        params.push(source)
    }

    const target = inject(config.target || '', injectable)
    if (target) {
        params.push(target)
    }

    options = config.options || {}

    const logger = context.logger.start('shell')

    return new Promise((resolve, reject) => {
        let errored = false

        options.stdio = 'inherit'
        options.shell = true

        const child = spawn(cmd, params, options)

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
