migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // Adicionar campo role se não existir
    if (!users.fields.getByName('role')) {
      users.fields.add(
        new SelectField({
          name: 'role',
          values: ['owner', 'seller'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // Adicionar campo phone se não existir
    if (!users.fields.getByName('phone')) {
      users.fields.add(
        new TextField({
          name: 'phone',
          required: false,
        }),
      )
    }

    // Usuários podem ver todos da equipe para atribuições e donos podem listar todos
    users.listRule = "@request.auth.id != ''"
    users.viewRule = "@request.auth.id != ''"
    users.createRule = '' // permite registro/convite
    users.updateRule =
      "@request.auth.id != '' && (id = @request.auth.id || @request.auth.role = 'owner')"
    users.deleteRule = "@request.auth.id != '' && @request.auth.role = 'owner'"

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const roleField = users.fields.getByName('role')
    if (roleField) users.fields.remove(roleField)
    const phoneField = users.fields.getByName('phone')
    if (phoneField) users.fields.remove(phoneField)
    app.save(users)
  },
)
