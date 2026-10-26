import type { Metadata } from 'next'

import { PaceCalculator } from '@/components/tools/calculators'
import { ToolPage } from '@/components/tools/tool-page'

export const metadata: Metadata = {
  title: 'Running Pace Calculator & Race Time Predictor | FitMeet',
  description: 'Convert a distance and time to pace per kilometre and speed, and predict your 5 km, 10 km, half marathon and marathon times with the Riegel formula. Free.',
  alternates: { canonical: 'https://fitmeet.fit/tools/pace-calculator/' },
}

export default function Page() {
  return (
    <ToolPage
      slug="pace-calculator"
      intro="Enter any distance and time to get your pace per kilometre and speed — and see what that result predicts for the classic race distances."
      explain={[
        { heading: 'Pace and speed', paragraphs: [
          'Pace is the time it takes to cover one kilometre (minutes per km), speed is the distance covered per hour (km/h). Runners usually think in pace, cyclists in speed. A 5:00/km pace equals 12 km/h.',
        ] },
        { heading: 'How race times are predicted', paragraphs: [
          'Predictions use the Riegel formula: T2 = T1 × (D2 ÷ D1)^1.06. The exponent accounts for the fact that you slow down as the distance grows. It works best between similar distances — a recent 10 km predicts a half marathon well, but a marathon also depends on long runs and fuelling.',
        ] },
        { heading: 'Using it for training paces', paragraphs: [
          'If your input is a recent 10 km race, easy runs are roughly 15–25 % slower than that pace, tempo runs a little slower than 10 km pace, and short intervals around your 5 km pace. Most runners improve faster by slowing down their easy days, not by running every day hard.',
        ] },
      ]}
    >
      <PaceCalculator />
    </ToolPage>
  )
}
