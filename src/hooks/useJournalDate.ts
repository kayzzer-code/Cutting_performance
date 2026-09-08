import { useOutletContext } from 'react-router-dom'

export interface JournalDateContext {
  selectedDate: string
  dateHref: (path: string) => string
  openFoodScanner: () => void
}

export function useJournalDate(): JournalDateContext {
  return useOutletContext<JournalDateContext>()
}
