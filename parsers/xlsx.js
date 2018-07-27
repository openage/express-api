var XLSX = require('xlsx')
const moment = require('moment')

const dateToString = (value, format) => {
    return moment(value).format(format || 'YYYY-MM-DD')
}

const cols = ['A', 'B', 'C', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']

let getCell = (excelSheet, row, column) => {
    let cellName = cols[column] + (row + 1)
    return excelSheet[cellName]
}

const extractHeaders = (sheet, config) => {
    config = config || {}
    let headerRow = config.headerRow || 0

    let headers = []

    for (let col = 0;; col++) {
        let cell = getCell(sheet, headerRow, col)
        if (!cell || cell.t === 'z') {
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

    for (let map of config.columnMap) {
        if (map.col === undefined) {
            let header = headers.find(item => item.label === map.label)

            if (header) {
                map.col = header.col
            }
        }
        if (!map.key) {
            let cell = getCell(sheet, headerRow, map.col)
            if (cell.t === 'z') {
                break
            }
            map.headerType = map.headerType || String

            let type = typeof map.headerType

            switch (type) {
            case 'string':
                map.key = cell.v
                break
            case 'date':
                map.key = dateToString(cell.d)
                break
            }
        }
    }

    return config.columnMap
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
        rows: async() => {
            let items = []
            let headerRow = config.headerRow || 0
            let keyCol = config.keyCol || 0
            for (let index = headerRow + 1;; index++) {
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

                    item[header.key] = cell.v

                    // switch (cell.t) {
                    // case 's':
                    //     item[header.key] = cell.v
                    //     break
                    // case 'd':
                    //     item[header.key] = cell.d
                    //     break
                    // case 'n':
                    //     item[header.key] = cell.n
                    //     break
                    // }
                }

                items.push(item)
            }
            return items
        }
    }
}
