exports.trim = (data, context) => {
    if (!context || !(context.exclude || context.include)) {
        return data
    }

    let val = {}

    if (context.include && context.include.length) {
        for (let include of context.include) {
            val[include] = data[include]
        }
    } else if (context.exclude && context.exclude.length) {
        val = data
        for (let exclude of context.exclude) {
            delete val[exclude]
        }
    }
    
    return val
}