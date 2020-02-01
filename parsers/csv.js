const csv = require('fast-csv')
const fs = require('fs')
const moment = require('moment')

const toDate = (value, timeZone) => {
    if (!value.endsWith('Z')) {
        value = `${value} ${timeZone}`
    }
    let date

    if (moment(value, 'DD-MM-YYYY').isValid()) {
        date = moment(value, 'DD-MM-YYYY').toDate()
    } else if (moment(value, 'YYYY-MM-DD').isValid()) {
        date = moment(value, 'YYYY-MM-DD').toDate()
    }

    return date
}

let getValue = (row, header, config) => {
    let value = row[header.label]

    let type = 'string'

    if (header.type) {
        type = (header.type.name || header.type).toLowerCase()
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
        value = value ? toDate(value, config.timeZone) : undefined
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

                            Object.getOwnPropertyNames(row).forEach(label => {
                                let key = label.replace(' ', '-').toLowerCase()
                                let map = config.columnMap.find(m =>
                                    m.label.toLowerCase() === label.toLowerCase() ||
                                    m.key.toLowerCase() === label.toLowerCase())
                                if (map) {
                                    item[map.key || key] = getValue(row, {
                                        label: label,
                                        type: map.type
                                    }, config)
                                } else {
                                    item[key] = row[label]
                                }
                            })
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
