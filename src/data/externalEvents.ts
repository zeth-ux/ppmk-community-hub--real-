export type ExternalEvent = {
  id: string
  title: string
  organizer: string
  date: string
  location: string
  category: string
  description: string
  url: string
}

export const externalEvents: ExternalEvent[] = [
  {
    id: 'external-01',
    title: 'International Student Festival',
    organizer: 'ERICA International Office',
    date: '2026-10-18',
    location: 'Hanyang ERICA Campus',
    category: 'Cultural',
    description:
      'A campus festival featuring international student communities, food and cultural activities.',
    url: '#',
  },

  {
    id: 'external-02',
    title: 'Global Student Networking Night',
    organizer: 'International Student Community',
    date: '2026-10-24',
    location: 'Ansan',
    category: 'Social',
    description:
      'Meet students from different countries and build new connections.',
    url: '#',
  },

  {
    id: 'external-03',
    title: 'International Career Workshop',
    organizer: 'University Career Center',
    date: '2026-10-29',
    location: 'ERICA Career Center',
    category: 'Career',
    description:
      'A workshop covering internships, job preparation and career opportunities in Korea.',
    url: '#',
  },

  {
    id: 'external-04',
    title: 'Multicultural Sports Day',
    organizer: 'Student Activities Center',
    date: '2026-11-02',
    location: 'ERICA Sports Field',
    category: 'Sports',
    description:
      'A casual sports day bringing together international and Korean students.',
    url: '#',
  },

  {
    id: 'external-05',
    title: 'Korean Language Exchange',
    organizer: 'International Student Community',
    date: '2026-11-07',
    location: 'ERICA Student Center',
    category: 'Academic',
    description:
      'Practice Korean and meet other students through casual language exchange.',
    url: '#',
  },

  {
    id: 'external-06',
    title: 'International Food Fair',
    organizer: 'Student Union',
    date: '2026-11-15',
    location: 'ERICA Main Plaza',
    category: 'Cultural',
    description:
      'Explore food and traditions from student communities around campus.',
    url: '#',
  },
]