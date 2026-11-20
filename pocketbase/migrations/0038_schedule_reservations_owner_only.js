/// <reference path="../pb_data/types.d.ts" />

/**
 * Reserva de agenda: SOMENTE o dono pode criar/remover.
 * Os demais papéis (vendedor, técnico "Somente OS") continuam podendo
 * apenas LISTAR/VER — a Agenda usa isso para exibir o cadeado sem liberar
 * a edição. O card de Configurações → Mensagens Automáticas continua
 * operando a mesma collection (mesmas regras).
 */
migrate(
  (app) => {
    const reservations = app.findCollectionByNameOrId('schedule_reservations')
    const ownerOnly = "@request.auth.id != '' && @request.auth.role = 'owner'"

    reservations.createRule = ownerOnly
    reservations.deleteRule = ownerOnly

    app.save(reservations)
  },
  (app) => {
    // Revert: volta a permitir a qualquer usuário autenticado.
    const reservations = app.findCollectionByNameOrId('schedule_reservations')
    const authRule = "@request.auth.id != ''"

    reservations.createRule = authRule
    reservations.deleteRule = authRule

    app.save(reservations)
  },
)
