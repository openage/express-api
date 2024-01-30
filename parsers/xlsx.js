var XLSX = require('xlsx')
const moment = require('moment')

const dateToString = (value, format) => {
    return moment(value).format(format || 'YYYY-MM-DD')
}

const toDate = (value, timeZone) => {
    if (!value.endsWith('Z')) {
        if (Date.parse(value)) {
            value = moment(new Date(value)).format('DD-MM-YYYY')
        }
        value = `${value} ${timeZone}`
    }
    let date

    if (moment(value).isValid()) {
        date = moment(value).toDate()
    } else if (moment(value, 'DD-MM-YYYY').isValid()) {
        date = moment(value, 'DD-MM-YYYY').toDate()
    } else if (moment(value, 'YYYY-MM-DD').isValid()) {
        date = moment(value, 'YYYY-MM-DD').toDate()
    } else if (moment(value, 'DD/MM/YY').isValid()) {
        date = moment(value, 'DD/MM/YY').toDate()
    }

    return date
}

let getValue = (cell, header, config) => {
    let value = cell.w

    let type = 'string'

    if (header.type) {
        type = (header.type.name || header.type).toLowerCase()
    }

    switch (type) {
        case 'number':
            if (typeof cell.v === 'number') {
                value = cell.v
            } else if (!value) {
                value = undefined
            } else if (value.indexOf('.') !== -1) {
                value = parseFloat(value)
            } else {
                value = parseInt(value)
            }
            break
        case 'boolean':
            if (typeof cell.v === 'boolean') {
                value = cell.v
            } else {
                value = !!cell.w
            }
            break
        case 'date':
            value = cell.w ? toDate(cell.w, config.timeZone) : undefined
            break
        case 'string':
            value = '' + cell.v
            break
        default:
            break
    }
    return value
}

const cols = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ',
    'BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN', 'BO', 'BP', 'BQ', 'BR', 'BS', 'BT', 'BU', 'BV', 'BW', 'BX', 'BY', 'BZ',
    'CA', 'CB', 'CC', 'CD', 'CE', 'CF', 'CG', 'CH', 'CI', 'CJ', 'CK', 'CL', 'CM', 'CN', 'CO', 'CP', 'CQ', 'CR', 'CS', 'CT', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ'
]

let getCell = (excelSheet, row, column) => {
    let cellName = cols[column] + (row + 1)
    return excelSheet[cellName]
}

const extractHeaders = (sheet, config) => {
    config = config || {}
    let headerRow = config.headerRow || 0

    let headers = []

    for (let col = 0; ; col++) {
        let cell = getCell(sheet, headerRow, col)
        if (!cell || cell.t === 'z' || !cell.v || cell.v === '') {
            break
        }

        let header = {
            col: col
        }

        switch (cell.t) {
            case 's':
                header.label = cell.v
                break
            case 'd':
                header.label = dateToString(cell.d)
                break
            case 'n':
                header.label = `${cell.n}`
                break
        }
        headers.push(header)
    }

    let columnMap = []
    for (let map of config.columnMap) {
        let item = JSON.parse(JSON.stringify(map))
        item.type = map.type
        columnMap.push(item)
    }

    for (let map of columnMap) {
        let header

        if (map.col === undefined) {
            header = headers.find(item => item.label === map.label)

            if (header) {
                map.col = header.col
            }
        }
        if (!map.key) {
            let cell = getCell(sheet, headerRow, map.col)
            if (cell.t === 'z') {
                break
            }

            let headerType = 'string'
            if (map.headerType) {
                headerType = (header.headerType.name || header.headerType).toLowerCase()
            }

            switch (headerType) {
                case 'string':
                    map.key = '' + cell.v
                    break
                case 'date':
                    map.key = dateToString(cell.w)
                    break
            }
        }
    }

    return columnMap
}

exports.parse = (file, config) => {
    var excelSheet = XLSX.readFile(file.path).Sheets[config.sheet]
    if (!excelSheet) {
        throw new Error(`Sheet '${config.sheet}' does not exist`)
    }

    // let getValue = (row, column) => {
    //     let cellName = cols[column] + row
    //     return excelSheet[cellName].v
    // }

    let headers = extractHeaders(excelSheet, config)

    return {
        // cell: (row, column) => {
        //     let cellName = cols[column] + row
        //     let value = excelSheet[cellName].v

        //     return {
        //         value: value,
        //         toDate: (timeZone) => {
        //             return toDate(value, timeZone)
        //         }
        //     }
        // },
        // row: (index) => {
        //     let item = {}
        //     for (let header of headers) {
        //         item[header.key] = getValue(index, header.col)
        //     }
        //     return item
        // },
        rows: async () => {
            let items = []
            let headerRow = config.headerRow || 0
            let keyCol = config.keyCol || 0
            for (let index = headerRow + 1; ; index++) {
                let keyCell = getCell(excelSheet, index, keyCol)
                if (!keyCell || keyCell.t === 'z') {
                    break
                }
                let item = {}
                for (let header of headers) {
                    let cell = getCell(excelSheet, index, header.col)

                    if (!cell || cell.t === 'z') {
                        continue
                    }
                    item[header.key] = getValue(cell, header, config)
                }
                items.push(item)
            }
            return items
        }
    }
}
