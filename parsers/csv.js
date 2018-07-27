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

    switch (header.type) {
    case 'number':
        if (!value) {
            value = 0
        } else if (value.indexOf('.') !== -1) {
            value = parseFloat(value)
        } else {
            value = parseInt(value)
        }
        break
    case 'date':
        value = toDate(value, config.timeZone)
        break
    case 'string':
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
                        let item = {}
                        for (let map of config.columnMap) {
                            item[map.key] = getValue(row, map, config)
                        }
                    })
                    .on('end', () => {
                        return resolve(items)
                    })
            })
        }
    }
}
