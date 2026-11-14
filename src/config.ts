export const APP_NAME = 'PPMK Community Hub'

// Google Form for pilot feedback (anonymous). Replace with the real link.
export const SURVEY_URL = 'https://forms.gle/REPLACE_ME'

// Shown on the privacy page. Shared EMSU account (not tied to one person).
export const CONTACT_EMAIL = 'emsu.hub@gmail.com'

/** True once a setting above has been replaced with a real value. */
export const isConfigured = (value: string) => !/replace_me|example\.com|todo/i.test(value)
