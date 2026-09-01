import { defaultPlanForTemplate } from './seed'
import type { AppState, DailyLog } from './types'

export function journalLogForDate(state: AppState, date: string): DailyLog {
  return state.logs[date] ?? {
    date,
    meals: [],
    activities: [],
    ...defaultPlanForTemplate(state.schedule[date] ?? 'rest', state.settings.dayTypePlans),
  }
}
