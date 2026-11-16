import type { TranslationKey } from '../../context/LanguageContext'
import type { MarketCategory, MarketCondition, MarketListing } from '../../lib/types'

export type Translate = (key: TranslationKey) => string

export const CATEGORY_KEYS: Record<MarketCategory, TranslationKey> = {
  textbook: 'market.catTextbook',
  electronics: 'market.catElectronics',
  kitchen: 'market.catKitchen',
  furniture: 'market.catFurniture',
  clothing: 'market.catClothing',
  other: 'market.catOther',
}

export const CONDITION_KEYS: Record<MarketCondition, TranslationKey> = {
  new: 'market.condNew',
  like_new: 'market.condLikeNew',
  good: 'market.condGood',
  fair: 'market.condFair',
}

/** "₩25,000" or "Free". */
export function formatPrice(l: Pick<MarketListing, 'kind' | 'price_krw'>, t: Translate, language: string) {
  if (l.kind === 'free' || l.price_krw === null) return t('market.free')
  return `₩${l.price_krw.toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US')}`
}

const normalise = (s: string) => s.toLowerCase().replace(/engineering/g, 'eng').replace(/[^a-z0-9가-힣]/g, '')

/** Loose match so "Mechanical Eng." finds "Mechanical Engineering". Books with no course match everyone. */
export function courseMatches(bookCourse: string | null, myCourse: string) {
  if (!bookCourse) return true
  const a = normalise(bookCourse)
  const b = normalise(myCourse)
  return !!a && !!b && (a.includes(b) || b.includes(a))
}

/**
 * A contact the seller typed: a link (open.kakao.com, wa.me, t.me,
 * instagram…) becomes a button; anything else is shown as text to copy.
 */
export function contactLink(contact: string): string | null {
  const text = contact.trim()
  if (/^https?:\/\/\S+$/i.test(text)) return text
  if (/^(open\.kakao\.com|wa\.me|t\.me|instagram\.com|www\.instagram\.com)\/\S+$/i.test(text)) return `https://${text}`
  return null
}
