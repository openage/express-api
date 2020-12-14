const csv = require('fast-csv')
const fs = require('fs')
const moment = require('moment')

const toDate = (value, map, config) => {
    if (map.format) {
        if (moment(value, map.format).isValid()) {
            return moment(value, map.format).toDate()
        }
    }
    if (!value.endsWith('Z')) {
        value = `${value} ${config.timeZone}`
    }
    let date

    if (moment(value, 'DD-MM-YYYY').isValid()) {
        date = moment(value, 'DD-MM-YYYY').toDate()
    } else if (moment(value, 'YYYY-MM-DD').isValid()) {
        date = moment(value, 'YYYY-MM-DD').toDate()
    }

    return date
}

let getValue = (value, map, row, config) => {

    let type = 'string'

    if (map.type) {
        type = (map.type.name || map.type).toLowerCase()
    }

    switch (type) {
        case 'number':
            if (!value) {
                value = undefined
            } else if (value.indexOf('.') !== -1) {
                value = parseFloat(value)
            } else {
                value = parseInt(value)
            }
            break
        // case 'boolean':
        //     if (typeof cell.v === 'boolean') {
        //         value = cell.v
        //     } else {
        //         value = !!cell.w
        //     }
        //     break
        case 'date':
            value = value ? toDate(value, map, config) : undefined
            break
        case 'string':
            value = value === undefined ? undefined : '' + value
            break
        default:
            break
    }
    return value
}

exports.parse = (file, config) => {
    return {
        rows: () => {
            const items = []
            let stream = fs.createReadStream(file.path)

            return new Promise((resolve, reject) => {
                csv.fromStream(stream, { headers: true, ignoreEmpty: true })
                    .on('data', (row) => {
                        if (config.columnMap) {
                            let item = {}

                            let labels = {}

                            Object.getOwnPropertyNames(row).forEach(l => {
                                labels[l.trim().toLowerCase()] = l
                            })

                            for (const map of config.columnMap) {
                                let value
                                if (map.label) {
                                    let label = labels[map.label.trim().toLowerCase()]
                                    value = row[label]
                                    if (value && map.empty && map.empty === value) {
                                        value = undefined
                                    }
                                }

                                if (!value) {
                                    if (map.value) {
                                        value = map.value
                                    } else if (map.values) {
                                        value = (map.values.find(v => {

                                            let result = true
                                            for (const condition of (v.conditions || [])) {
                                                switch (condition.operator) {
                                                    case '!!':
                                                        result = result && (!!item[condition.key] === condition.value)
                                                        break
                                                    case '==':
                                                    case '===':
                                                        result = result && (item[condition.key] === condition.value)
                                                        break
                                                    case '>':
                                                        result = result && (item[condition.key] > condition.value)
                                                        break
                                                    case '<':
                                                        result = result && (item[condition.key] < condition.value)
                                                        break
                                                }
                                            }

                                            return result

                                        }) || {}).value
                                    }
                                }

                                item[map.key] = getValue(value, map, row, config)
                            }

                            items.push(item)
                        } else {
                            items.push(row)
                        }
                    })
                    .on('end', () => {
                        return resolve(items)
                    })
            })
        }
    }
}
