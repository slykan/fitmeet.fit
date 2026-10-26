import type { Metadata } from 'next'

import { HrZoneCalculator } from '@/components/tools/calculators'
import { ToolPage } from '@/components/tools/tool-page'

export const metadata: Metadata = {
  title: 'Heart Rate Zone Calculator (Max HR and Karvonen) | FitMeet',
  description: 'Calculate your five heart-rate training zones from your maximum heart rate or heart-rate reserve (Karvonen). Free, no sign-up.',
  alternates: { canonical: 'https://fitmeet.fit/tools/heart-rate-zones/' },
}

export default function Page() {
  return (
    <ToolPage
      slug="heart-rate-zones"
      intro="Get your five training zones in beats per minute — from your real maximum heart rate if you know it, or an age-based estimate if you don't, with the option to include your resting heart rate."
      explain={[
        { heading: 'Percent of max or heart rate reserve?', paragraphs: [
          'The simple method takes a percentage of your maximum heart rate: zone 2, for example, is 60–70 % of max. Heart rate reserve (the Karvonen method) first subtracts your resting heart rate, then adds the percentage of what is left. It gives slightly higher zones and fits fitter people with a low resting heart rate better.',
        ] },
        { heading: 'Where does the max come from?', paragraphs: [
          'If you leave max heart rate empty, the calculator estimates it with the Tanaka formula, 208 − 0.7 × age. Real values differ from any formula by 10–20 bpm for many people, so the best number is the highest heart rate you have seen in a recent hard effort — a race finish or the last rep of a hard interval session — measured with a chest strap or a reliable watch.',
        ] },
        { heading: 'What each zone is for', paragraphs: [
          'Zone 1 is recovery, zone 2 builds your aerobic base and is where most of your training should be, zone 3 is tempo, zone 4 is threshold — around your one-hour race effort — and zone 5 is for short, maximal efforts. Many athletes do about 80 % of their training in zones 1–2 and 20 % in zones 4–5.',
        ] },
      ]}
    >
      <HrZoneCalculator />
    </ToolPage>
  )
}
