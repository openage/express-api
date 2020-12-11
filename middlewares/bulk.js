const pathExists = require('path-exists')
const appRoot = require('app-root-path')
const formidable = require('formidable')
const changeCase = require('change-case')

const apiConfig = require('config').api || {}
apiConfig.importers = apiConfig.importers || {}
apiConfig.importers.dir = apiConfig.importers.dir || 'importers'
apiConfig.importers.defaultFile = apiConfig.importers.defaultFile || 'default'

const inflate = (flattened) => {
    let model = {}

    Object.getOwnPropertyNames(flattened).forEach(key => {
        const value = flattened[key]

        if (!value) {
            return
        }

        let parts = key.split('-')
        let index = 0
        let obj = model

        for (let part of parts) {
            if (index === parts.length - 1) {
                obj[part] = value
            } else {
                if (part.indexOf('[') > 0) {
                    let arrayParts = part.split('[')
                    part = arrayParts[0]
                    obj[part] = obj[part] || []

                    let array = obj[part]

                    let arrayIndex = arrayParts[1].substring(0, arrayParts[1].length - 1)

                    array[arrayIndex] = array[arrayIndex] || {}
                    obj = array[arrayIndex]
                } else {
                    obj[part] = obj[part] || {}
                    obj = obj[part]
                }
            }

            index++
        }
    })

    return model
}

const importViaConfig = async (req, file, handler) => {
    let type = 'csv'
    if (file.type) {
        switch (file.type) {
            case 'text/csv':
                type = 'csv'
                break
            case 'application/vnd.ms-excel':
                type = 'xlsx'
                break
            case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                type = 'xlsx'
                break
            default:
                throw new Error(`file type '${file.type}' is not supported`)
        }
    }

    const format = req.query['format'] || apiConfig.importers.defaultFile

    let config = await handler.config(req, { format: format, type: type })

    let rows = await require(`../parsers/${type}`).parse(file, config).rows()

    rows = rows.map(r => inflate(r))

    if (!config.modelMap) {
        return rows
    }
    const items = []

    for (const row of rows) {
        let mappedItem = await config.modelMap(row, config, req)
        if (!mappedItem) {
            continue
        }

        if (!Array.isArray(mappedItem)) {
            items.push(mappedItem)
        } else if (mappedItem.length) {
            mappedItem.forEach(item => {
                items.push(item)
            })
        }
    }
    return items
}

const fileWrapper = (req) => {
    return new Promise((resolve, reject) => {
        var form = new formidable.IncomingForm()

        form.parse(req, function (err, fields, incomingFiles) {
            if (err) {
                reject(err)
            }
            let keys = Object.keys(incomingFiles)
            const files = []

            keys.forEach(key => files.push(incomingFiles[key]))
            if (files.length === 0) {
                resolve(null)
            } else {
                resolve(files[0])
            }
        })
    })
}

exports.getMiddleware = (apiName, action) => {
    if (action !== '/bulk') {
        return null
    }

    return function (req, res, next) {
        if (req.body.items) {
            return next()
        }

        const logger = req.context.logger.start(`${apiConfig.importers.dir}/importers/${apiName}`)

        return fileWrapper(req).then(file => {
            if (!file) {
                return next()
            }

            logger.silly(`got a file '${file.name}' to extract`)
            const ext = file.name.split('.')[1]

            const format = req.query['format'] || apiConfig.importers.defaultFile

            const type = changeCase.paramCase(apiName)

            let handlerFile = `${appRoot}/${apiConfig.importers.dir}/${type}/${ext}/${format}`

            if (!pathExists.sync(`${handlerFile}.js`)) {
                handlerFile = `${appRoot}/${apiConfig.importers.dir}/${type}/${ext}`
                if (!pathExists.sync(`${handlerFile}.js`)) {
                    handlerFile = `${appRoot}/${apiConfig.importers.dir}/${type}`
                    if (!pathExists.sync(`${handlerFile}.js`)) {
                        logger.debug(`importer '${handlerFile}' does not exist `)
                        return next()
                    }
                }
            }

            let handler = require(handlerFile)

            let handerPromise

            if (handler.config) {
                handerPromise = importViaConfig(req, file, handler)
            } else if (handler.import) {
                handerPromise = handler.import(req, file, format, ext)
            } else {
                logger.error(`importer '${handlerFile}' does not implement import `)
                return next()
            }

            return handerPromise.then(items => {
                req.body.items = items
                logger.end()
                next()
            }).catch(err => {
                logger.error(err)
                logger.end()
                return next(err)
            })
        }).catch(err => {
            logger.error(err)
            logger.end()
            return next(err)
        })
    }
}
