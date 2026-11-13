import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { usePageMeta } from '../lib/usePageMeta'

import { CONTACT_EMAIL, isConfigured } from '../config'

const visibilityRows = [
  ['You', 'Your whole profile, your RSVPs, your posts and photos (including ones waiting for approval)'],
  [
    'Other members and visitors',
    'Your @username, posts and comments you did not make anonymous, approved photos, and the clubs you are a member of (with your role). Never your name, phone, student ID or email',
  ],
  [
    'Event organizers',
    'Your profile details (incl. phone) and RSVP, only for events you RSVP to, the same as filling in their Google Form',
  ],
  ['Club leaders', 'Your @username, batch and join message when you ask to join their club'],
  [
    'EMSU admins',
    'The member list, club applications, and photos waiting for review. Admins can remove posts, but the app does not show them who wrote anonymous ones',
  ],
  [
    'Anyone not signed in',
    'The homepage, open events (title, date, place), club names, Opportunities, and Explore Korea posts with approved photos. No personal details',
  ],
]

const sections: [string, ReactNode][] = [
  [
    'What we collect',
    'Members: your email (to sign in), a username, student ID, name, batch, age, phone, course, where you live, your answers to events (going / maybe / not going, an optional note, whether you checked in) and the clubs you join. Visitors: only an email and a username. Everyone: the posts, comments, votes and photos you choose to share. Photos are shrunk in your browser before upload, which also removes hidden location (GPS) data. No location tracking and no social media.',
  ],
  [
    'Why',
    'To run PPMK/EMSU events and clubs without a new form every time, and to let the community share tips and find teammates.',
  ],
  [
    'Where it is stored',
    'In a Supabase cloud database and private file storage (photos), served over encrypted connections (HTTPS). The website is hosted on Vercel. These services may store data on servers outside Korea. Access rules are enforced inside the database itself, not just hidden on screen. Photos are only viewable through short-lived links, and only after an admin approves them.',
  ],
  [
    'Who is responsible',
    'EMSU (Hanyang ERICA) is responsible for this data, not any individual student. During the pilot, the hub is run by the EMSU tech team.',
  ],
  [
    'How long we keep it',
    'While you are an active student. You can delete everything yourself at any time. Data of graduated students is deleted within one year of graduation.',
  ],
  [
    'Your rights',
    <>
      You can see and correct your details on your{' '}
      <Link to="/me" className="font-semibold text-primary underline">profile page</Link>, and
      delete your account there with one button: this removes your profile, RSVPs, club memberships,
      posts, comments and photo records. You can also delete any single post or photo yourself. Your consent is required
      before your profile is saved, and you can withdraw it by deleting your account.
    </>,
  ],
  [
    'AI features',
    "Organizers can use AI (Google's Gemini) to turn their rough notes into an event and to write announcements in English, Malay and Korean; for this, only event information is sent. Students can use the \"Ask the Hub\" chatbot: it sends your question, the events and clubs you can see, and your OWN RSVP answers (which events you said going / maybe / not going to), never your name, phone number, student ID or anything about other students. Because we use Google's free tier, Google may use the text sent to improve its services, so please don't type personal details into the chat or notes. The AI only suggests; it can't RSVP or change anything for you. We count how often each person uses the AI (to keep within the free limit) but don't store the text.",
  ],
  [
    'Sharing',
    'We never sell your data or share it outside PPMK/EMSU event organizing.',
  ],
  [
    'Legal',
    "We aim to follow Korea's Personal Information Protection Act (PIPA) and Hanyang University's rules. This notice is part of a student course project pilot and will be reviewed with EMSU before wider use.",
  ],
]

export default function PrivacyPage() {
  usePageMeta('Privacy', 'What the PPMK Community Hub stores, who can see it, and how to delete it.')
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section>
        <h1 className="font-display text-5xl sm:text-6xl">Your data</h1>
        <p className="mt-4 text-[15px] leading-7 text-slate-600">
          PPMK Community Hub is a pilot for Malaysian students in Korea, starting
          with EMSU at Hanyang ERICA. Here is exactly what happens to your
          information, in plain language. Last updated November 2026.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-surface p-5">
        <h2 className="text-lg font-bold">Who can see what?</h2>
        <dl className="mt-3 divide-y divide-slate-100">
          {visibilityRows.map(([who, what]) => (
            <div key={who} className="grid gap-1 py-3 sm:grid-cols-[180px_1fr]">
              <dt className="text-sm font-semibold">{who}</dt>
              <dd className="text-sm leading-6 text-slate-600">{what}</dd>
            </div>
          ))}
        </dl>
      </section>

      {sections.map(([title, body], index) => (
        <section key={title} className="rounded-xl border border-slate-200 bg-surface p-5">
          <h2 className="text-lg font-bold">
            {index + 1}. {title}
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
        </section>
      ))}

      <section className="rounded-xl border border-slate-200 bg-surface p-5">
        <h2 className="text-lg font-bold">Questions or requests</h2>
        <p className="mt-2 text-sm text-slate-600">
          {isConfigured(CONTACT_EMAIL) ? (
            <>
              Contact the EMSU tech team at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-primary underline">
                {CONTACT_EMAIL}
              </a>
              .
            </>
          ) : (
            'Contact the EMSU committee through the EMSU group chat.'
          )}
        </p>
      </section>
    </div>
  )
}
