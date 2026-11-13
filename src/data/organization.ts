// Everything on the "About PPMK & EMSU" page lives here, so the committee
// can update it without touching the page code.
//
// TEAM: fill in the empty fields below (committee names, contacts). Anything
// left empty is simply not shown on the site, so no placeholder text leaks.

export type OrgContact = { label: string; value: string; href?: string }
export type OrgPerson = { role: string; name: string }

export const ppmk = {
  shortName: 'PPMK',
  fullName: 'Persatuan Pelajar Malaysia Korea',
  englishName: 'Malaysian Students’ Association in Korea',
  summary:
    'PPMK is the non-profit welfare association for Malaysian students studying in South Korea. It connects students across universities, supports their welfare and studies, and works with the Embassy of Malaysia in Seoul on programmes for the community.',
  focus: [
    { title: 'Welfare', text: 'Support for students who need help: housing, health, emergencies and settling in.' },
    { title: 'Community', text: 'Festive celebrations, sports and gatherings that bring Malaysians in Korea together.' },
    { title: 'Academic & career', text: 'Study support, sharing sessions with seniors, and links to internships and jobs.' },
    { title: 'Representation', text: 'A voice for Malaysian students with universities and the Embassy.' },
  ],
  // e.g. { label: 'Instagram', value: '@handle', href: 'https://www.instagram.com/handle' }
  contacts: [] as OrgContact[],
}

export const emsu = {
  shortName: 'EMSU',
  // Full name of EMSU, e.g. 'ERICA Malaysian Students Union' (leave '' if unsure).
  fullName: '',
  summary:
    'EMSU is the Malaysian student community at Hanyang University ERICA, Ansan. It runs events for Malaysian students on campus and is the pilot group for this hub.',
  members: '~70 students',
  campus: 'Hanyang University ERICA, Ansan',
  // Fill in names; empty ones are hidden.
  committee: [
    { role: 'President', name: '' },
    { role: 'Vice President', name: '' },
    { role: 'Secretary', name: '' },
    { role: 'Treasurer', name: '' },
    { role: 'Events', name: '' },
    { role: 'Welfare', name: '' },
  ] as OrgPerson[],
  // e.g. { label: 'KakaoTalk open chat', value: 'Join the EMSU chat', href: 'https://open.kakao.com/o/...' }
  contacts: [] as OrgContact[],
}

/** What a group must prepare to register a new club under PPMK/EMSU. */
export const CLUB_DOCUMENTS = [
  {
    key: 'constitution',
    title: 'Club constitution',
    detail: 'Name, aims, who can join, committee positions and how they are chosen, and meeting rules. 1–3 pages is enough.',
    required: true,
  },
  {
    key: 'member_list',
    title: 'Founding member list',
    detail: 'At least 5 founding members: name, student ID, batch and a signature or confirmation from each.',
    required: true,
  },
  {
    key: 'activity_plan',
    title: 'Activity plan for the semester',
    detail: 'What you plan to do, roughly when, and where. For example "monthly hike, one overnight trip".',
    required: true,
  },
  {
    key: 'committee_list',
    title: 'Proposed committee',
    detail: 'Who will be president, vice president, secretary and treasurer, with contacts.',
    required: true,
  },
  {
    key: 'budget',
    title: 'Budget estimate',
    detail: 'Only if you will ask PPMK/EMSU for funding or collect fees from members.',
    required: false,
  },
  {
    key: 'advisor_letter',
    title: 'Advisor support letter',
    detail: 'Optional: a short note from a lecturer or the International Office supporting the club.',
    required: false,
  },
] as const

/** Only real, filled-in entries are shown on the site. */
export const filled = <T extends { name?: string; value?: string }>(rows: T[]) =>
  rows.filter((r) => (r.name ?? r.value ?? '').trim() && !/todo|example\.com|replace_me/i.test(r.name ?? r.value ?? ''))
