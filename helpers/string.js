/* eslint-disable no-extend-native */
'use strict'
const validator = require('validator')

// eslint-disable-next-line no-extend-native
String.prototype.toObjectId = function () {
    const ObjectId = (require('mongoose').Types.ObjectId)
    return new ObjectId(this.toString())
}

// eslint-disable-next-line no-extend-native
String.prototype.isObjectId = function () {
    return validator.isMongoId(this)
}

String.prototype.isEmail = function () {
    return validator.isEmail(this)
}

String.prototype.isPhone = function () {
    const code = this

    return code.match(/^\d{10}$/) ||
        code.match(/^(\+\d{1,3}[- ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/) ||
        code.match(/^(\+\d{1,3}[- ]?)?\(?([0-9]{2})\)?[-. ]?([0-9]{4})[-. ]?([0-9]{4})$/)
}

String.prototype.isMobile = function () {
    const code = this

    return code.match(/^\d{10}$/) ||
        code.match(/^(\+\d{1,3}[- ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/) ||
        code.match(/^(\+\d{1,3}[- ]?)?\(?([0-9]{2})\)?[-. ]?([0-9]{4})[-. ]?([0-9]{4})$/)
}

String.prototype.isUUID = function () {
    return validator.isUUID(this)
}

String.prototype.toTitleCase = function () {
    const str = this

    return str.toLowerCase().trim().split(' ').map((word) => {
        return word ? word.replace(word[0], word[0].toUpperCase()) : word
    }).join(' ')
}

// eslint-disable-next-line no-extend-native
String.prototype.inject = function (data, context) {
    const template = this
    let isObject = false
    // eslint-disable-next-line space-before-function-paren
    function getValue(obj, is, value) {
        if (typeof is === 'string') {
            is = is.split('.')
        }
        if (is.length === 1 && value !== undefined) {
            // eslint-disable-next-line no-return-assign
            if ((typeof obj === 'object') && (Object.keys(obj).length != 0)) {
                isObject = true
                value = JSON.stringify(value)
            }
            // eslint-disable-next-line no-return-assign
            return obj[is[0]] = value
        } else if (is.length === 0) {
            if (obj && (typeof obj === 'object') && (Object.keys(obj).length != 0)) {
                isObject = true
                let l = {}
                let keys = Object.keys(obj)
                keys.sort()
                keys.forEach(key => {
                    l[key] = obj[key]
                })
                obj = l
                obj = JSON.stringify(obj)
            }
            return obj
        } else {
            const prop = is.shift()
            // Forge a path of nested objects if there is a value to set
            if (value !== undefined && obj[prop] === undefined) { obj[prop] = {} }
            return getValue(obj[prop], is, value)
        }
    }

    let templateString = template.replace(/\$\{(.+?)\}/g, (match, p1) => getValue(data, p1))
    if (isObject) {
        const replateArray = [
            { from: '"[', to: '[' },
            { from: ']"', to: ']' },
            { from: '"{', to: '{' },
            { from: '}"', to: '}' },
            { from: '[object ', to: '{' },
            { from: 'Object]', to: '}' }]
        if (replateArray.some(el => templateString.includes(el.from))) {
            templateString = removeDoubleQuotes(templateString, replateArray)
        }
    }

    context.logger.debug(`String-Json: ${templateString}`)
    return templateString
}

const removeDoubleQuotes = (templateString, replateArray) => {
    for (const r of replateArray) {
        const strr = templateString.split(r.from)
        templateString = strr.join(r.to)
    }
    if (replateArray.some(el => templateString.includes(el.from))) {
        removeDoubleQuotes(templateString)
    }
    return templateString
}

global.toObjectId = id => require('mongoose').Types.ObjectId(id)
