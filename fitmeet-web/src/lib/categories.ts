export const CATEGORIES = [
  { value: 'fitness',     emoji: '💪',  label: 'Fitness' },
  { value: 'running',     emoji: '🏃',  label: 'Running' },
  { value: 'cycling',     emoji: '🚴',  label: 'Cycling' },
  { value: 'hiking',      emoji: '🥾',  label: 'Hiking' },
  { value: 'swimming',    emoji: '🏊',  label: 'Swimming' },
  { value: 'football',    emoji: '⚽',  label: 'Football' },
  { value: 'basketball',  emoji: '🏀',  label: 'Basketball' },
  { value: 'tennis',      emoji: '🎾',  label: 'Tennis' },
  { value: 'volleyball',  emoji: '🏐',  label: 'Volleyball' },
  { value: 'yoga',        emoji: '🧘',  label: 'Yoga' },
  { value: 'martial_arts',emoji: '🥋',  label: 'Martial Arts' },
  { value: 'skiing',      emoji: '⛷️',  label: 'Skiing' },
  { value: 'surfing',     emoji: '🏄',  label: 'Surfing' },
  { value: 'climbing',    emoji: '🏔️',  label: 'Climbing' },
  { value: 'padel',       emoji: '🏓',  label: 'Padel' },
  { value: 'darts',       emoji: '🎯',  label: 'Pikado' },
  { value: 'ice_skating',    emoji: '⛸️',  label: 'Ice Skating' },
  { value: 'inline_skating', emoji: '🛼',  label: 'Inline Skating' },
  { value: 'walking',        emoji: '🚶',  label: 'Walking' },
  { value: 'party',       emoji: '🎉',  label: 'Party' },
  { value: 'chill',       emoji: '😎',  label: 'Chill' },
  { value: 'food_drinks', emoji: '🍕',  label: 'Food & Drinks' },
  { value: 'music',       emoji: '🎵',  label: 'Music' },
  { value: 'gaming',      emoji: '🎮',  label: 'Gaming' },
  { value: 'beach',       emoji: '🏖️',  label: 'Beach' },
  { value: 'camping',     emoji: '🏕️',  label: 'Camping' },
  { value: 'kayaking',    emoji: '🚣',  label: 'Kayaking' },
  { value: 'photography', emoji: '📷',  label: 'Photography' },
  { value: 'art',         emoji: '🎨',  label: 'Art' },
  { value: 'other',       emoji: '📌',  label: 'Other' },
] as const

export type CategoryValue = typeof CATEGORIES[number]['value']

export const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.emoji])
)

// Shown as primary pills in filters; rest go behind "More…"
export const FILTER_FEATURED = ['running', 'cycling', 'hiking']
