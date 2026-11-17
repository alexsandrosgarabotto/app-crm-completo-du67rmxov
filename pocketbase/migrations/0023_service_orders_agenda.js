/// <reference path="../pb_data/types.d.ts" />

/**
 * Agenda operacional do bot de WhatsApp.
 * --------------------------------------------------------
 * - technicians: técnicos cadastrados (o primeiro ativo é o técnico
 *   principal padrão das OS criadas pelo bot).
 * - schedule_reservations: reserva de um dia inteiro (sem horário) ou de
 *   um horário específico — datas/horários reservados nunca são ofertados
 *   pelo bot.
 * - holidays: feriados nacionais 2025/2026 pré-cadastrados (também não
 *   são ofertados).
 * - service_orders: technician_id (referencia technicians por id) e
 *   order_type ("orcamento" | "visita_tecnica").
 * - whatsapp_conversations: schedule_state/schedule_data, máquina de
 *   estados do fluxo de agendamento conversacional.
 */
migrate(
  (app) => {
    const authRule = "@request.auth.id != ''"
    const publicReadAuthWrite = {
      listRule: authRule,
      viewRule: authRule,
      createRule: authRule,
      updateRule: authRule,
      deleteRule: authRule,
    }

    // --- Coleção technicians -------------------------------------------------
    if (!app.hasTable('technicians')) {
      const technicians = new Collection({
        name: 'technicians',
        type: 'base',
        ...publicReadAuthWrite,
        fields: [
          { name: 'name', type: 'text', required: true, max: 200 },
          { name: 'phone', type: 'text', max: 40 },
          { name: 'active', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_technicians_active ON technicians (active)'],
      })
      app.save(technicians)
    }

    // --- Coleção schedule_reservations ----------------------------------------
    if (!app.hasTable('schedule_reservations')) {
      const reservations = new Collection({
        name: 'schedule_reservations',
        type: 'base',
        ...publicReadAuthWrite,
        fields: [
          { name: 'date', type: 'date', required: true },
          // Vazio = dia inteiro bloqueado para o bot.
          { name: 'time', type: 'text', max: 5 },
          { name: 'reason', type: 'text', max: 300 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_schedule_reservations_date ON schedule_reservations (date)'],
      })
      app.save(reservations)
    }

    // --- Coleção holidays + feriados nacionais 2025/2026 ----------------------
    if (!app.hasTable('holidays')) {
      const holidays = new Collection({
        name: 'holidays',
        type: 'base',
        ...publicReadAuthWrite,
        fields: [
          { name: 'date', type: 'date', required: true },
          { name: 'name', type: 'text', max: 200 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_holidays_date ON holidays (date)'],
      })
      app.save(holidays)

      const holidayList = [
        ['2025-01-01 00:00:00.000Z', 'Confraternização Universal'],
        ['2025-03-03 00:00:00.000Z', 'Carnaval'],
        ['2025-03-04 00:00:00.000Z', 'Carnaval'],
        ['2025-04-18 00:00:00.000Z', 'Sexta-feira Santa'],
        ['2025-04-21 00:00:00.000Z', 'Tiradentes'],
        ['2025-05-01 00:00:00.000Z', 'Dia do Trabalho'],
        ['2025-06-19 00:00:00.000Z', 'Corpus Christi'],
        ['2025-09-07 00:00:00.000Z', 'Independência do Brasil'],
        ['2025-10-12 00:00:00.000Z', 'Nossa Senhora Aparecida'],
        ['2025-11-02 00:00:00.000Z', 'Finados'],
        ['2025-11-15 00:00:00.000Z', 'Proclamação da República'],
        ['2025-11-20 00:00:00.000Z', 'Consciência Negra'],
        ['2025-12-25 00:00:00.000Z', 'Natal'],
        ['2026-01-01 00:00:00.000Z', 'Confraternização Universal'],
        ['2026-02-16 00:00:00.000Z', 'Carnaval'],
        ['2026-02-17 00:00:00.000Z', 'Carnaval'],
        ['2026-04-03 00:00:00.000Z', 'Sexta-feira Santa'],
        ['2026-04-21 00:00:00.000Z', 'Tiradentes'],
        ['2026-05-01 00:00:00.000Z', 'Dia do Trabalho'],
        ['2026-06-04 00:00:00.000Z', 'Corpus Christi'],
        ['2026-09-07 00:00:00.000Z', 'Independência do Brasil'],
        ['2026-10-12 00:00:00.000Z', 'Nossa Senhora Aparecida'],
        ['2026-11-02 00:00:00.000Z', 'Finados'],
        ['2026-11-15 00:00:00.000Z', 'Proclamação da República'],
        ['2026-11-20 00:00:00.000Z', 'Consciência Negra'],
        ['2026-12-25 00:00:00.000Z', 'Natal'],
      ]
      const holidaysCollection = app.findCollectionByNameOrId('holidays')
      for (const [date, name] of holidayList) {
        // Idempotente: pula feriados já cadastrados.
        let exists = []
        try {
          exists = app.findRecordsByFilter('holidays', 'date = {:date}', '', 1, 0, { date: date })
        } catch (_) {}
        if (exists.length > 0) continue
        const record = new Record(holidaysCollection)
        record.set('date', date)
        record.set('name', name)
        app.save(record)
      }
    }

    // --- service_orders: technician_id e order_type ---------------------------
    const orders = app.findCollectionByNameOrId('service_orders')
    let ordersChanged = false
    if (!orders.fields.getByName('technician_id')) {
      orders.fields.add(new TextField({ name: 'technician_id', max: 30 }))
      ordersChanged = true
    }
    if (!orders.fields.getByName('order_type')) {
      orders.fields.add(new TextField({ name: 'order_type', max: 30 }))
      ordersChanged = true
    }
    if (ordersChanged) {
      app.save(orders)
    }

    // --- whatsapp_conversations: schedule_state e schedule_data ---------------
    const conversations = app.findCollectionByNameOrId('whatsapp_conversations')
    let convChanged = false
    if (!conversations.fields.getByName('schedule_state')) {
      conversations.fields.add(new TextField({ name: 'schedule_state', max: 40 }))
      convChanged = true
    }
    if (!conversations.fields.getByName('schedule_data')) {
      conversations.fields.add(new JSONField({ name: 'schedule_data', maxSize: 2000000 }))
      convChanged = true
    }
    if (convChanged) {
      app.save(conversations)
    }
  },
  (app) => {
    // Reversão: mantém os dados (a remoção de campos apagaria OS/conversas).
  },
)
