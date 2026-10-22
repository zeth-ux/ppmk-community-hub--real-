import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'

import { CONTACT_EMAIL } from '../config'

const visibilityRows = [
  ['You', 'Your whole profile and your RSVPs'],
  ['Other students', 'Nothing about you. They only see how many people are going'],
  [
    'Event organizers',
    'Your profile details (incl. phone) and RSVP, only for events you RSVP to, the same as filling in their Google Form',
  ],
  ['EMSU admins', 'The member list, to manage roles and the hub'],
  ['Anyone not signed in', 'Nothing'],
]

const sections: [string, ReactNode][] = [
  [
    'What we collect',
    'Your email (to sign in), student ID, name, batch, age, phone, course, where you live, and your answers to events (going / maybe / not going, an optional note, and whether you checked in). Nothing else: no location tracking, no social media, no photos.',
  ],
  [
    'Why',
    'Only to run PPMK/EMSU community events, so you don\'t have to fill in the same details in a new form for every event.',
  ],
  [
    'Where it is stored',
    'In a Supabase cloud database, served over encrypted connections (HTTPS). The website is hosted on Vercel. These services may store data on servers outside Korea. Access rules are enforced inside the database itself, not just hidden on screen.',
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
      delete your account and all your RSVPs there with one button. Your consent is required
      before your profile is saved, and you can withdraw it by deleting your account.
    </>,
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
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-red-50 p-3 text-primary">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">Privacy notice</p>
            <h1 className="text-2xl font-bold sm:text-3xl">How we handle your data</h1>
          </div>
        </div>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          PPMK Community Hub is a pilot for Malaysian students at Hanyang ERICA,
          starting with EMSU members. Here is exactly what happens to your
          information, in plain language.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
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
        <section key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">
            {index + 1}. {title}
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
        </section>
      ))}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">Questions or requests</h2>
        <p className="mt-2 text-sm text-slate-600">
          Contact the EMSU tech team at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-primary underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </div>
  )
}
