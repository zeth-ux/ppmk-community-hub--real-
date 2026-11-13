// Type check only (never imported by the app): the design-preview API must
// offer exactly what the real API offers, so `npm run demo` can't drift.
import type * as real from '../lib/api'
import * as demo from './api'

const sameShape: typeof real = demo
void sameShape

import type * as realAi from '../lib/ai'
import * as demoAi from './ai'

const sameAi: Pick<typeof realAi, 'aiAsk' | 'aiExtractEvent' | 'aiWriteAnnouncements' | 'announcementSource'> = demoAi
void sameAi
