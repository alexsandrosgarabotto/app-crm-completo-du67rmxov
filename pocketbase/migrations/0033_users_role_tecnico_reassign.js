migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const roleField = users.fields.getByName('role')
    if (roleField && roleField.type === 'select') {
      const values = roleField.values || []
      const next = []
      for (let i = 0; i < values.length; i++) next.push(values[i])
      if (next.indexOf('tecnico') === -1) next.push('tecnico')
      roleField.setValues(next)
      app.save(users)
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const roleField = users.fields.getByName('role')
    if (roleField && roleField.type === 'select') {
      const values = roleField.values || []
      const next = []
      for (let i = 0; i < values.length; i++) next.push(values[i])
      const filtered = []
      for (let i = 0; i < next.length; i++) {
        if (next[i] !== 'tecnico') filtered.push(next[i])
      }
      roleField.setValues(filtered)
      app.save(users)
    }
  },
)
