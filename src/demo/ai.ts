// Design-preview stand-in for src/lib/ai.ts: canned answers, no AI and no
// server, so the preview also works as a plain static website.
import type { AiAnnounceResult, AiAskResult, AiExtractResult, AiTone, ChatTurn } from '../lib/ai'

export { announcementSource } from '../lib/ai'
export type { AiAnnounceResult, AiAskResult, AiExtractResult, AiTone, ChatTurn } from '../lib/ai'

const wait = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 700))
const base = { model: 'preview (no real AI)', remaining: 39 }

export function aiExtractEvent(notes: string): Promise<AiExtractResult> {
  void notes
  return wait({
    ...base,
    event: {
      title: 'Futsal Friendly Match',
      category: 'Sports',
      event_date: null,
      start_time: '20:00',
      end_time: '22:00',
      location: 'ERICA Futsal Court',
      capacity: 20,
      rsvp_deadline: null,
      bring: 'Sports shoes, water',
      notes: '',
      description: 'Friendly futsal match, all levels welcome.',
    },
    missing: ['event_date'],
    warnings: ['This is a sample answer: the design preview does not call the real AI.'],
  })
}

export function aiWriteAnnouncements(eventId: string, tone: AiTone): Promise<AiAnnounceResult> {
  void eventId
  return wait({
    ...base,
    tone,
    announcements: {
      en: '📣 Hi everyone! Join us for this event. RSVP with one tap at the link below!',
      ms: '📣 Hai semua! Jom sertai acara ini. RSVP dengan satu klik di pautan bawah!',
      ko: '📣 안녕하세요! 이번 행사에 함께해요. 아래 링크에서 한 번에 참가 신청하세요!',
    },
  })
}

export function aiAsk(question: string, history: ChatTurn[]): Promise<AiAskResult> {
  void question
  void history
  return wait({
    ...base,
    answer: "This is the design preview, so I'm not the real AI. Here are a couple of upcoming events you might like:",
    eventIds: ['evt-badminton', 'evt-makan'],
    clubIds: ['club-badminton'],
  })
}
