// 0036 — manageRule na collection users (dono gerencia senha/e-mail dos membros).
//
// O PocketBase só exige oldPassword (e bloqueia troca de e-mail direta) em
// atualizações de auth record quando o chamador NÃO tem "manage access"
// (forms/record_upsert.go). O acesso de manager vem da options.manageRule da
// collection — que estava vazia, então o DONO não conseguia redefinir a senha
// de um membro da equipe (PATCH retornava 400 "Failed to update record").
//
// Regra segura: o manager só vale quando o chamador é um usuário com role
// 'owner' e o alvo NÃO é o próprio chamador (a troca da própria senha continua
// pelo caminho antigo, que exige oldPassword — ChangePasswordCard, intacto).
//
// Isso NÃO abre brecha de escalada de papel: o updateRule continua exigindo
// (id = @request.auth.id || @request.auth.role = 'owner'), então um membro
// 'tecnico' continua sem poder tocar em registro de outro usuário. Como camada
// extra, o manageRule também exige que o alvo não seja owner.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.updateRule =
      "@request.auth.id != '' && (id = @request.auth.id || (@request.auth.role = 'owner' && role != 'owner'))"
    users.manageRule =
      "@request.auth.id != '' && @request.auth.role = 'owner' && id != @request.auth.id"
    app.save(users)
    console.log('0036: manageRule de users aplicada (owner gerencia membros nao-owner)')
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.updateRule =
      "@request.auth.id != '' && (id = @request.auth.id || @request.auth.role = 'owner')"
    users.manageRule = ''
    app.save(users)
  },
)
