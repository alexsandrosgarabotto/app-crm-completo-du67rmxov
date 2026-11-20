// 0035 — valor 'tecnico' no select role de users (TENTATIVA FINAL).
//
// As migrações 0027 (values.push), 0032, 0033 (setValues) e 0034 (atribuição
// direta + setValues) constam como aplicadas mas o banco VIVO permaneceu com
// apenas owner | seller — mutar o campo devolvido por fields.getByName() não
// persiste nesta instância. O ÚNICO padrão que comprovadamente persistiu foi
// o da 0001: fields.add(new SelectField({...})). Esta migração REMOVE o campo
// role e o RECRIA com os 3 valores, restaurando o papel de cada usuário
// existente logo depois (recriar o campo derruba a coluna e os dados dela).
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const roleField = users.fields.getByName('role')

    // Snapshot dos papéis atuais antes de derrubar a coluna.
    const snapshot = []
    if (roleField) {
      const existentes = app.findRecordsByFilter('users', 'id != ""', '-created', 10000, 0)
      for (let i = 0; i < existentes.length; i++) {
        snapshot.push({ id: existentes[i].id, role: String(existentes[i].get('role') || '') })
      }
    }

    // Remove e recria o campo com os 3 valores (padrão da 0001).
    if (roleField) users.fields.removeByName('role')
    users.fields.add(
      new SelectField({
        name: 'role',
        values: ['owner', 'seller', 'tecnico'],
        maxSelect: 1,
        required: false,
      }),
    )
    app.save(users)

    // Restaura os papéis existentes.
    for (let i = 0; i < snapshot.length; i++) {
      const papel = snapshot[i].role
      if (papel === '' || papel === 'owner' || papel === 'seller' || papel === 'tecnico') {
        if (papel === '') continue
        try {
          const registro = app.findRecordById('users', snapshot[i].id)
          registro.set('role', papel)
          app.save(registro)
        } catch (err) {
          console.log('0035: falha ao restaurar papel de ' + snapshot[i].id + ' — ' + err)
        }
      }
    }
    console.log(
      '0035: campo role recriado com owner|seller|tecnico; papéis restaurados: ' + snapshot.length,
    )
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const roleField = users.fields.getByName('role')
    if (!roleField) return

    const snapshot = []
    const existentes = app.findRecordsByFilter('users', 'id != ""', '-created', 10000, 0)
    for (let i = 0; i < existentes.length; i++) {
      const papel = String(existentes[i].get('role') || '')
      snapshot.push({ id: existentes[i].id, role: papel === 'tecnico' ? 'seller' : papel })
    }

    users.fields.removeByName('role')
    users.fields.add(
      new SelectField({
        name: 'role',
        values: ['owner', 'seller'],
        maxSelect: 1,
        required: false,
      }),
    )
    app.save(users)

    for (let i = 0; i < snapshot.length; i++) {
      const papel = snapshot[i].role
      if (papel === '') continue
      try {
        const registro = app.findRecordById('users', snapshot[i].id)
        registro.set('role', papel)
        app.save(registro)
      } catch (err) {
        console.log('0035 down: falha ao restaurar papel de ' + snapshot[i].id + ' — ' + err)
      }
    }
  },
)
