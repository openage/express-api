/* eslint-disable no-extend-native */
'use strict'
const validator = require('validator')

// eslint-disable-next-line no-extend-native
const toObjectId = function (key) {
    if (typeof key != "string") {
        throw new Error("key is not a string")
    }
    const ObjectId = (require('mongoose').Types.ObjectId)
    return new ObjectId(key.toString())
}

// eslint-disable-next-line no-extend-native
const isObjectId = function (key) {
    if (typeof key != "string") {
        throw new Error("key is not a string")
    }
    return validator.isMongoId(key)
}

const isEmail = function (key) {
    if (typeof key != "string") {
        throw new Error("key is not a string")
    }
    return validator.isEmail(key)
}

const isPhone = function (key) {
    if (typeof key != "string") {
        throw new Error("key is not a string")
    }
    const code = key

    return code.match(/^\d{10}$/) ||
        code.match(/^(\+\d{1,3}[- ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/) ||
        code.match(/^(\+\d{1,3}[- ]?)?\(?([0-9]{2})\)?[-. ]?([0-9]{4})[-. ]?([0-9]{4})$/)
}

const isMobile = function (key) {
    if (typeof key != "string") {
        throw new Error("key is not a string")
    }
    const code = key

    return code.match(/^\d{10}$/) ||
        code.match(/^(\+\d{1,3}[- ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/) ||
        code.match(/^(\+\d{1,3}[- ]?)?\(?([0-9]{2})\)?[-. ]?([0-9]{4})[-. ]?([0-9]{4})$/)
}

const isUUID = function (key) {
    if (typeof key != "string") {
        throw new Error("key is not a string")
    }
    return validator.isUUID(key)
}

const toTitleCase = function (key) {
    if (typeof key != "string") {
        throw new Error("key is not a string")
    }
    const str = key

    return str.toLowerCase().trim().split(' ').map((word) => {
        return word ? word.replace(word[0], word[0].toUpperCase()) : word
    }).join(' ')
}

// eslint-disable-next-line no-extend-native
const inject = function (key, data, context) {
    if (typeof key != "string") {
        throw new Error("key is not a string")
    }
    const template = key
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
            if (obj && (typeof obj === 'object')) {
                if ((Object.keys(obj).length != 0)) {
                    isObject = true
                    let l = {}
                    let keys = Object.keys(obj)
                    keys.sort()
                    keys.forEach(key => {
                        l[key] = obj[key]
                    })
                    obj = l
                    obj = JSON.stringify(obj)
                } else {
                    obj = ""
                }

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

module.exports = {
    toObjectId,
    isObjectId,
    isEmail,
    isPhone,
    isMobile,
    isUUID,
    toTitleCase,
    inject
}