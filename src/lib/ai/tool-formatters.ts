const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Zaplanowana',
  completed: 'Odbyła się',
  cancelled: 'Anulowana',
  no_show: 'Nieobecność',
}

export const TOOL_CONFIRMATION_LABELS: Record<string, (args: Record<string, unknown>) => string> = {
  create_appointment: (args) =>
    `Zarezerwuj wizytę ${args.date} o ${args.start_time} (${args.duration} min)`,

  update_appointment: (args) =>
    `Zaktualizuj wizytę na ${args.date} o ${args.start_time} (${args.duration} min)`,

  delete_appointment: () =>
    `Usuń wizytę`,

  update_appointment_status: (args) =>
    `Zmień status wizyty na: ${STATUS_LABELS[String(args.status)] ?? String(args.status)}`,

  create_client: (args) =>
    `Dodaj klienta: ${args.first_name} ${args.last_name}`,

  update_client: (args) =>
    `Zaktualizuj dane klienta${args.first_name ? `: ${args.first_name} ${args.last_name}` : ''}`,

  delete_client: () =>
    `USUŃ klienta i wszystkie jego wizyty`,

  create_package: (args) =>
    `Dodaj pakiet: ${args.name} (${args.visit_count} wizyt, ${args.price} PLN)`,

  update_package: (args) =>
    `Zaktualizuj pakiet: ${args.name ?? ''}`,

  delete_package: () =>
    `Usuń pakiet`,
}

export const DESTRUCTIVE_TOOLS = new Set(['delete_client', 'delete_appointment'])
