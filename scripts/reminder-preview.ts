// Shows what a reminder email looks like, with a made-up student and event.
// Sends nothing and needs no keys. Run: npm run reminders:preview
import { buildReminderEmail } from '../api/reminders.ts'

const email = buildReminderEmail(
  {
    event_id: 'example-event',
    user_id: 'example-user',
    email: 'student@example.com',
    full_name: 'Aisyah Rahman',
    status: 'attending',
    title: 'Futsal Night',
    event_date: '2026-11-21',
    start_time: '20:00:00',
    end_time: '22:00:00',
    location: 'ERICA Sports Complex',
    bring: 'Indoor shoes, water bottle',
  },
  'https://ppmk-community-hub-real.vercel.app',
)

console.log(`To:      ${email.to}\nSubject: ${email.subject}\n\n${email.text}`)
