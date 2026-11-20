migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const roleField = users.fields.getByName('role')
    if (!roleField || roleField.type !== 'select') {
      console.log('0034: campo role de users não é select — nada a fazer')
      return
    }
    const current = JSON.parse(JSON.stringify(roleField.values || []))
    const next = []
    for (let i = 0; i < current.length; i++) next.push(current[i])
    if (next.indexOf('tecnico') === -1) next.push('tecnico')
    if (next.length === current.length) {
      console.log('0034: tecnico já presente em users.role — nada a fazer')
      return
    }
    roleField.values = next
    roleField.setValues(next)
    app.save(users)
    console.log('0034: users.role salvo com valores: ' + next.join(','))
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const roleField = users.fields.getByName('role')
    if (!roleField || roleField.type !== 'select') return
    const current = JSON.parse(JSON.stringify(roleField.values || []))
    const filtered = []
    for (let i = 0; i < current.length; i++) {
      if (current[i] !== 'tecnico') filtered.push(current[i])
    }
    if (filtered.length === current.length) return
    roleField.values = filtered
    roleField.setValues(filtered)
    app.save(users)
  },
)
