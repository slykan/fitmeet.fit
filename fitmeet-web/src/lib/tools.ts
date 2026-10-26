// Free calculators (/tools) — each page = explanation (static HTML) + a client-side calculator.
export interface ToolInfo {
  slug: string
  title: string
  short: string
  guide: string // matching guide slug
}

export const tools: ToolInfo[] = [
  { slug: 'bmr-calculator', title: 'BMR & Daily Calorie Calculator', short: 'Basal metabolic rate (Mifflin-St Jeor or Katch-McArdle) and an estimate of your total daily burn.', guide: 'bmr-and-daily-calories' },
  { slug: 'heart-rate-zones', title: 'Heart Rate Zone Calculator', short: 'Your five training zones from max heart rate or heart-rate reserve (Karvonen).', guide: 'heart-rate-training-zones' },
  { slug: 'pace-calculator', title: 'Running Pace Calculator', short: 'Pace, speed and race-time predictions for 5 km, 10 km, half and full marathon.', guide: 'running-paces-explained' },
]
