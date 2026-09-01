import { useOutletContext } from 'react-router-dom'

export interface JournalDateContext {
  selectedDate: string
  dateHref: (path: string) => string
}

export function useJournalDate(): JournalDateContext {
  return useOutletContext<JournalDateContext>()
}
