const crud = require('../helpers/crud')

exports.sessions = crud('directory', 'sessions')
exports.roles = crud('directory', 'roles')
exports.users = crud('directory', 'users')
exports.organizations = crud('directory', 'organizations')
exports.tenants = crud('directory', 'tenants')
