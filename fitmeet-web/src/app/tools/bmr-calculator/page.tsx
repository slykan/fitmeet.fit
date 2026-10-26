import type { Metadata } from 'next'

import { BmrCalculator } from '@/components/tools/calculators'
import { ToolPage } from '@/components/tools/tool-page'

export const metadata: Metadata = {
  title: 'BMR & Daily Calorie Calculator (Mifflin-St Jeor, Katch-McArdle) | FitMeet',
  description: 'Calculate your basal metabolic rate and total daily energy expenditure. Uses Mifflin-St Jeor, or Katch-McArdle when you know your body fat. Free, no sign-up.',
  alternates: { canonical: 'https://fitmeet.fit/tools/bmr-calculator/' },
}

export default function Page() {
  return (
    <ToolPage
      slug="bmr-calculator"
      intro="Find out how much energy your body uses at rest (BMR) and roughly how much you burn in a full day (TDEE), plus sensible targets for maintaining, losing or gaining weight."
      explain={[
        { heading: 'How the calculation works', paragraphs: [
          'Without body fat, the calculator uses the Mifflin-St Jeor equation: 10 × weight (kg) + 6.25 × height (cm) − 5 × age, plus 5 for men or minus 161 for women. It is the most accurate of the common equations for most people, usually within about 10 % of a lab measurement.',
          'If you enter your body fat percentage, it switches to Katch-McArdle: 370 + 21.6 × lean body mass in kg. Because it only looks at lean mass, it handles muscular and very lean people better.',
        ] },
        { heading: 'From BMR to daily calories', paragraphs: [
          'Your total daily burn is BMR multiplied by an activity factor, from 1.2 for a sedentary day to about 1.9 for a physical job plus hard training. Be honest with the activity level — picking one level too high is the most common reason calorie targets do not work.',
          'For gradual fat loss, about 300–500 kcal below maintenance is sustainable for most people. For lean muscle gain, a small surplus of 200–300 kcal together with strength training is enough.',
        ] },
        { heading: 'Treat it as a starting point', paragraphs: [
          'Any equation is an average. Track your weight for three to four weeks: if it stays stable, your real maintenance is close to what you are eating, whatever the calculator said. Adjust from there.',
        ] },
      ]}
    >
      <BmrCalculator />
    </ToolPage>
  )
}
