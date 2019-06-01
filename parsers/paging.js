exports.parse = req => {
    let serverPaging = req.query.serverPaging

    if (serverPaging === undefined) {
        if (req.query.pageNo !== undefined || req.query.pageSize !== undefined || req.query.limit !== undefined) {
            serverPaging = true
        }
    } else {
        serverPaging = serverPaging === 'true' ? true : serverPaging
    }

    if (req.query.noPaging !== undefined) {
        req.query.noPaging = req.query.noPaging === 'false' ? false : req.query.noPaging
    }
    if (!serverPaging || req.query.noPaging) {
        return null
    }

    let limit = 10
    if (req.query.pageSize) {
        limit = Number(req.query.pageSize)
    }
    if (req.query.limit) {
        limit = Number(req.query.limit)
    }

    let offset = 0
    let pageNo = 1
    if (req.query.offset !== undefined) {
        offset = Number(req.query.offset)
        pageNo = Math.floor(offset / limit) + 1
    } else if (req.query.pageNo !== undefined) {
        pageNo = Number(req.query.pageNo)
        offset = limit * (pageNo - 1)
    }

    return {
        pageNo: pageNo,
        limit: limit,
        take: limit,
        offset: offset,
        skip: offset
    }
}
