exports.check = (data, condition) => {
    if(!data )
    return evaluate(condition.key, condition.value, condition.operator, data)
}

const evaluate = (key, value, operator, data) => {
    let result = operator != 'OR'
    value = value == 'null' || value == 'undefined' ? null : value

    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            const v = value[i]
            if (operator == 'OR') { result = result || evaluate(v.key, v.value, v.operator, data) }
            if (operator == 'AND') { result = result && evaluate(v.key, v.value, v.operator, data) }
        }
        return result
    } else {
        const keyValue = getValue(data, key.split('.'))
        switch (operator) {
            case '>':
                return keyValue > value
            case '<':
                return keyValue < value
            case '<=':
                return keyValue <= value
            case '>=':
                return keyValue >= value
            case '==':
                return keyValue == value
            case '===':
                return keyValue === value
            case '!=':
                return keyValue != value
        }
    }
}

const getValue = (obj, key, i = 0) => {
    if (typeof obj == 'object' && !obj.hasOwnProperty(key[i])) {
        return null
    } else if (obj[key[i]] && typeof obj[key[i]] == 'object') {
        return getValue(obj[key[i]], key, i + 1)
    } else {
        return obj[key[i]]
    }
}