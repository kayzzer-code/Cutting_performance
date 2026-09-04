import { trainingLog } from './training'
import type { AppState, DailyLog } from './types'

export function journalLogForDate(state: AppState, date: string): DailyLog {
  return trainingLog(state, date)
}
