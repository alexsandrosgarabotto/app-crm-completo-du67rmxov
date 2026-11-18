migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const roleField = users.fields.getByName('role')
    if (roleField && roleField.type === 'select' && roleField.values.indexOf('tecnico') === -1) {
      roleField.values.push('tecnico')
      app.save(users)
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const roleField = users.fields.getByName('role')
    if (roleField && roleField.type === 'select') {
      roleField.values = roleField.values.filter(function (v) {
        return v !== 'tecnico'
      })
      app.save(users)
    }
  },
)
