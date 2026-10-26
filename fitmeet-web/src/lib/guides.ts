import type { PostSection } from '@/lib/posts'

// Evergreen training guides (/guides) — practical, sport-science based reading that stands on
// its own (not product news). Each can point to a matching calculator in /tools.

export interface Guide {
  slug: string
  title: string
  description: string
  updatedAt: string
  readTime: number
  category: string
  tool?: { href: string; label: string }
  sections: PostSection[]
}

export const guides: Guide[] = [
  {
    slug: 'heart-rate-training-zones',
    title: 'Heart Rate Training Zones Explained: How to Find Yours and Use Them',
    description: 'What the five heart-rate zones mean, why "220 minus your age" is often wrong, three better ways to set your zones, and how to split your training between easy and hard.',
    updatedAt: '2026-10-26',
    readTime: 7,
    category: 'Training',
    tool: { href: '/tools/heart-rate-zones', label: 'Heart rate zone calculator' },
    sections: [
      {
        paragraphs: [
          'Heart rate is the simplest window into how hard your body is actually working. Pace and speed change with hills, wind and heat; power needs a power meter. Heart rate is on almost every watch, and once you know your own zones it tells you whether a session is building your base, pushing your threshold, or just making you tired.',
          'This guide explains the five classic zones, how to set them for yourself instead of using a formula that may be off by 15 beats, and how to spread your week across them.',
        ],
      },
      {
        heading: 'The Five Zones in Plain Words',
        paragraphs: [
          'Most watches and apps use five zones based on a percentage of your maximum heart rate. The exact boundaries differ a little between systems, but the idea is the same.',
          'Zone 1 (about 50–60 % of max) is recovery: an easy spin, a warm-up, a walk. Zone 2 (60–70 %) is endurance: you can hold a full conversation, and this is where the aerobic engine is built — more capillaries, more mitochondria, better fat use. Zone 3 (70–80 %) is tempo: comfortably hard, talking in short sentences. Zone 4 (80–90 %) is threshold: the pace you could hold for roughly an hour in a race, breathing hard, only a few words at a time. Zone 5 (90–100 %) is maximal: short intervals, sprints and the end of a race.',
          'A good rule of thumb: if you are unsure which zone you are in, the talk test rarely lies. Full sentences means zone 2 or below, short phrases means zone 3–4, single words means zone 4–5.',
        ],
      },
      {
        heading: 'Why "220 Minus Age" Is Often Wrong',
        paragraphs: [
          'The formula 220 − age is easy to remember, but it was never meant to be precise for individuals. Real maximum heart rates of people the same age commonly differ by 10–20 beats per minute in either direction. If your real max is 195 and the formula says 180, every zone your watch shows is too low, and your "easy" runs are not easy at all.',
          'A slightly better estimate is the Tanaka formula: 208 − 0.7 × age. For a 40-year-old that gives 180, the same as 220 − age; for a 60-year-old it gives 166 instead of 160. It is still an average, so treat any formula as a starting point, not a measurement.',
        ],
      },
      {
        heading: 'Three Better Ways to Set Your Zones',
        paragraphs: [
          'Use the highest heart rate you have really seen. Look through your last few months of hard sessions — a race finish, a steep climb, the last rep of an interval session — and take the highest reliable value from a chest strap or a good optical sensor. If you have trained hard recently, this is usually within a few beats of your true max.',
          'Do a field test. After a thorough warm-up, run or ride uphill for about three minutes at a hard but even effort, recover for two to three minutes, and repeat once more going all-out over the last minute. The peak value of the second effort is a decent estimate of your max. Only do this if you are healthy and used to hard efforts — and if you have any heart condition or doubts, ask your doctor first.',
          'Use heart rate reserve (the Karvonen method). Heart rate reserve is your max minus your resting heart rate. Zones are then calculated as resting HR + a percentage of the reserve. Because it accounts for your resting heart rate, it fits fitter people better. Measure resting HR in the morning, lying down, before getting up — ideally as an average of a few days.',
        ],
      },
      {
        heading: 'How to Spread Your Week Across the Zones',
        paragraphs: [
          'Studies of endurance athletes keep finding the same pattern: the best ones spend roughly 75–80 % of their training time at low intensity (zones 1–2) and only 15–20 % hard (zones 4–5), with little time in the grey middle. This is often called polarised or 80/20 training.',
          'Most recreational athletes do the opposite: almost every session ends up in zone 3, too hard to recover from properly and too easy to raise the ceiling. If that sounds familiar, slow your easy days down — even if it feels embarrassingly slow — and make your one or two hard sessions a week properly hard.',
          'For a typical week with four sessions, that could mean two long or medium easy sessions in zone 2, one interval or threshold session, and one relaxed recovery session or group ride.',
        ],
      },
      {
        heading: 'Common Pitfalls',
        paragraphs: [
          'Heart rate lags behind effort. In short intervals of one to two minutes, it may not reach the target zone before the rep is over — judge those by feel or pace instead.',
          'Heat, dehydration, caffeine, poor sleep and illness all push heart rate up. If it is 10 beats higher than usual at an easy pace, that is information: slow down or take a rest day.',
          'Over a long effort, heart rate slowly drifts upward even at a constant pace (cardiac drift). That is normal, especially in the heat; drink and don\'t chase the number.',
        ],
      },
    ],
  },
  {
    slug: 'bmr-and-daily-calories',
    title: 'BMR and TDEE: How Many Calories Do You Really Burn in a Day?',
    description: 'Basal metabolic rate, the four parts of your daily energy expenditure, the formulas behind calorie calculators, and how to use the numbers without obsessing over them.',
    updatedAt: '2026-10-26',
    readTime: 7,
    category: 'Health',
    tool: { href: '/tools/bmr-calculator', label: 'BMR and daily calorie calculator' },
    sections: [
      {
        paragraphs: [
          'Whether you want to lose weight, gain muscle or simply have enough energy for your training, it helps to know roughly how much energy you use in a day. That number is called your total daily energy expenditure, or TDEE. Its biggest part is your basal metabolic rate, the BMR.',
          'This guide explains what goes into both, how calculators estimate them, and where the estimates can be off.',
        ],
      },
      {
        heading: 'What BMR Is',
        paragraphs: [
          'Basal metabolic rate is the energy your body needs at complete rest just to keep you alive: breathing, circulation, keeping your temperature, brain and organ function. For most adults it is somewhere between 1,300 and 2,000 kcal a day, and it typically makes up 60–70 % of everything you burn.',
          'BMR depends mainly on how much lean mass you carry. Muscle and organs use far more energy than fat tissue, which is why two people of the same weight can have quite different BMRs, and why BMR usually drops slowly with age as muscle mass declines.',
        ],
      },
      {
        heading: 'How Calculators Estimate BMR',
        paragraphs: [
          'Measuring BMR properly requires a lab, so calculators use equations. The most widely used today is Mifflin-St Jeor: 10 × weight in kg + 6.25 × height in cm − 5 × age + 5 for men, or − 161 for women. In studies it predicts measured resting energy expenditure within about 10 % for most people.',
          'If you know your body fat percentage, the Katch-McArdle equation is often better: 370 + 21.6 × lean body mass in kg. Because it ignores sex and age and looks only at lean mass, it handles muscular athletes better — Mifflin-St Jeor tends to underestimate them.',
          'Body fat from a home smart scale is not very precise, but even a rough figure moves the estimate in the right direction for people who are much leaner or more muscular than average.',
        ],
      },
      {
        heading: 'The Four Parts of Your Daily Burn',
        paragraphs: [
          'Your total daily energy expenditure is made of four parts. BMR is the largest. Non-exercise activity — walking, standing, housework, fidgeting — is the most variable: it can range from a couple of hundred to well over a thousand kcal a day between a desk worker and someone who is on their feet all day. Your steps are the easiest way to see it; a rough rule is about 0.04–0.05 kcal per step for a 75–80 kg person.',
          'Exercise is the part you plan. A one-hour easy ride may burn 400–600 kcal, a hard run more per minute. Watches estimate it from heart rate; power meters on bikes are more accurate, because mechanical work in kilojoules roughly equals the calories burned.',
          'Finally, digesting food costs energy too — the thermic effect of food, about 10 % of what you eat, a little more for protein.',
        ],
      },
      {
        heading: 'Activity Multipliers vs. Counting the Parts',
        paragraphs: [
          'Many calculators simply multiply BMR by an activity factor: about 1.2 for sedentary, 1.375 for light activity, 1.55 for moderate, 1.725 for very active. It is quick, but the categories are vague, and active people often pick a factor that is too high.',
          'Adding up the parts — BMR, your average steps, your actual trainings and digestion — gives a more personal estimate, especially for people whose training varies a lot from day to day.',
        ],
      },
      {
        heading: 'Using the Numbers Sensibly',
        paragraphs: [
          'Every figure here is an estimate, typically within 10–15 % for a given person. The best way to calibrate it is your own data: if your weight is stable over three or four weeks while you eat around a certain amount, that amount is your real maintenance.',
          'For gradual fat loss, a daily deficit of about 300–500 kcal is a common, sustainable target; much more tends to hurt training quality, recovery and mood. If you train a lot, don\'t cut deeply on hard training days — fuel those, and keep the deficit on easier days.',
          'And if you have a medical condition, an eating disorder history or specific goals, talk to a doctor or a registered dietitian rather than relying on calculators alone.',
        ],
      },
    ],
  },
  {
    slug: 'ftp-and-watts-per-kilo',
    title: 'FTP and W/kg Explained: The Numbers Every Cyclist Talks About',
    description: 'What functional threshold power is, how to test it at home or on the road, what watts per kilo tells you, and how to use power zones in training.',
    updatedAt: '2026-10-26',
    readTime: 6,
    category: 'Cycling',
    sections: [
      {
        paragraphs: [
          'If you ride with a power meter or a smart trainer, sooner or later someone asks: "What\'s your FTP?" Functional threshold power has become the reference number of cycling training, and watts per kilo the way riders compare climbing ability.',
        ],
      },
      {
        heading: 'What FTP Means',
        paragraphs: [
          'Functional threshold power is the highest average power you can sustain for about an hour in a steady, hard effort. It sits close to your lactate threshold — the point above which fatigue builds quickly.',
          'Because riding all-out for a full hour is unpleasant and hard to pace, FTP is usually estimated from shorter tests.',
        ],
      },
      {
        heading: 'How to Test It',
        paragraphs: [
          'The classic 20-minute test: warm up well (15–20 minutes with a few short efforts), ride 20 minutes as hard as you can at an even effort, and take 95 % of the average power. Pacing is everything — start a little conservatively and finish strong.',
          'A ramp test is shorter: power rises every minute until you can\'t continue, and FTP is estimated as about 75 % of the best one-minute power. It is easy to do on a smart trainer, but riders with a strong sprint tend to get a slightly inflated value.',
          'You can also estimate FTP from hard rides you already do — for example the best 20-minute power from a race or a long climb. Retest every six to eight weeks, or when training feels clearly too easy or too hard.',
        ],
      },
      {
        heading: 'Why Watts per Kilo Matters',
        paragraphs: [
          'On the flat, absolute power and aerodynamics decide speed, so heavier riders with high watts do well. Uphill, gravity dominates, and what matters is power relative to body weight: FTP divided by weight in kilograms, or W/kg.',
          'As a very rough guide, many untrained adults are around 2 W/kg, regular recreational riders 2.5–3.5, strong amateur racers 4 and above, and professional climbers above 6. Treat those as orientation, not as a judgement — improving your own number is what counts.',
          'There are two ways to raise W/kg: more watts or fewer kilos. Losing weight only helps if power holds; aggressive dieting usually costs more watts than it saves in kilos.',
        ],
      },
      {
        heading: 'Training With Power Zones',
        paragraphs: [
          'Once you know your FTP, zones follow from it. A common scheme is: active recovery below about 55 % of FTP, endurance 56–75 %, tempo 76–90 %, threshold 91–105 %, VO2max 106–120 % and anaerobic efforts above that.',
          'As with heart rate, most of your riding should be endurance, with focused sessions at threshold (for example 2 × 20 minutes at 95–100 % FTP) or VO2max (for example 5 × 4 minutes at about 110–115 %) once or twice a week.',
          'Power reacts instantly while heart rate lags, so power is ideal for intervals. Heart rate still adds context: if the same power costs more beats than usual, you may be tired, hot or getting sick.',
        ],
      },
    ],
  },
  {
    slug: 'running-paces-explained',
    title: 'Easy, Tempo, Intervals: A Practical Guide to Running Paces',
    description: 'How fast your easy runs, tempo runs and intervals should be, how to estimate race times from a recent result, and why most runners run their easy days too fast.',
    updatedAt: '2026-10-26',
    readTime: 6,
    category: 'Running',
    tool: { href: '/tools/pace-calculator', label: 'Running pace calculator' },
    sections: [
      {
        paragraphs: [
          'Running more doesn\'t automatically mean running better. Progress comes from mixing different paces on purpose: a lot of easy running, some steady tempo work and a little fast running. Here is what each one is for and how to find your numbers.',
        ],
      },
      {
        heading: 'Easy Pace: The Foundation',
        paragraphs: [
          'Easy runs build your aerobic base, strengthen tendons and bones, and let you recover between harder days. They should feel genuinely relaxed: you can talk in full sentences and breathe through your nose for much of the run.',
          'For most people that is 60–90 seconds per kilometre slower than their 10 km race pace. If you can run 10 km in 50 minutes (5:00/km), easy running is around 6:00–6:30/km. Most runners do their easy runs too fast, which leaves them too tired for the sessions that matter.',
        ],
      },
      {
        heading: 'Tempo and Threshold',
        paragraphs: [
          'A tempo run is "comfortably hard": roughly the pace you could hold for an hour in a race, which for many recreational runners lies between their 10 km and half-marathon pace. It trains your body to clear lactate and to hold a strong pace for longer.',
          'Typical sessions are 20–30 minutes continuous, or 3–4 × 8–10 minutes with short jog recoveries. If you finish feeling you could have done one more, the pace was right.',
        ],
      },
      {
        heading: 'Intervals',
        paragraphs: [
          'Intervals at around 5 km race pace or a little faster — for example 5 × 1,000 m or 6 × 3 minutes with equal recovery — raise your VO2max, the ceiling of your aerobic system. Short, fast reps of 200–400 m improve running economy and leg speed.',
          'Keep the total amount of fast running modest: in a week, intervals rarely need to be more than 8–10 % of your total distance.',
        ],
      },
      {
        heading: 'Estimating Race Times',
        paragraphs: [
          'A recent race is the best predictor of your fitness. A widely used formula by Peter Riegel estimates a time at a new distance as T2 = T1 × (D2 ÷ D1)^1.06. A 25-minute 5 km, for example, predicts about 52 minutes for 10 km and about 1:55 for a half marathon.',
          'Predictions get less reliable the further you extrapolate — especially to the marathon, which also depends on long-run training and fuelling. Use them to set sensible training paces, not as promises.',
        ],
      },
      {
        heading: 'Pace vs. Heart Rate vs. Feel',
        paragraphs: [
          'Pace is objective but changes with hills, wind, heat and surface. Heart rate adjusts for those conditions but lags in short reps. Perceived effort ties everything together. The best runners use all three: pace for intervals on the flat, heart rate to keep easy runs easy, and feel when conditions are unusual.',
        ],
      },
    ],
  },
  {
    slug: 'fueling-before-during-after-training',
    title: 'What to Eat Before, During and After Training',
    description: 'Simple, evidence-based guidance on carbohydrates, protein and fluids around your workouts — from a short gym session to a long ride.',
    updatedAt: '2026-10-26',
    readTime: 7,
    category: 'Health',
    sections: [
      {
        paragraphs: [
          'What you eat around training affects how hard you can go, how well you recover and whether the session leaves you hungry and drained. You don\'t need special products for most workouts — just the right amount at the right time.',
          'The figures below are general guidance for healthy adults. If you have diabetes, an allergy, or another medical condition, follow your doctor\'s or dietitian\'s advice.',
        ],
      },
      {
        heading: 'Before: Top Up, Don\'t Fill Up',
        paragraphs: [
          'For a session in the next two to four hours, a normal meal with carbohydrates, some protein and not too much fat or fibre works well — for example oats with yoghurt and fruit, or rice with chicken and vegetables.',
          'If you train within an hour of eating, keep it small and easy to digest: a banana, a slice of bread with honey, or a yoghurt. Many people can do an easy morning session fasted, but hard or long sessions usually go better with something in the tank.',
        ],
      },
      {
        heading: 'During: Only When It\'s Long',
        paragraphs: [
          'For sessions under about an hour, water is enough. For longer endurance efforts, carbohydrate intake during exercise clearly improves performance: around 30–60 g per hour for one to two and a half hours, and up to 90 g per hour for very long efforts, ideally from a mix of glucose and fructose that the gut can absorb at the same time.',
          'Thirty grams is roughly a banana, a gel or 500 ml of a typical sports drink. Practise fuelling in training — the gut adapts — rather than trying something new on race day.',
          'Fluids: drink to thirst in normal conditions. In heat, or for long sessions, weigh yourself before and after: losing more than about 2 % of body weight tends to hurt performance. Replace sodium on long, sweaty sessions.',
        ],
      },
      {
        heading: 'After: Protein and Carbs',
        paragraphs: [
          'After training, protein supports muscle repair and adaptation. Around 20–40 g of protein (roughly 0.3 g per kg of body weight) in the meal after training is a good target — for example a chicken breast, a tin of tuna, three eggs with a glass of milk, or a portion of skyr.',
          'Carbohydrates refill your glycogen stores. If you train again within a day, prioritise carbs in the hours after training; if not, your normal meals will usually refill them.',
          'Over the whole day, people who train regularly generally do well with about 1.2–1.6 g of protein per kg of body weight, spread over three or four meals.',
        ],
      },
      {
        heading: 'Common Mistakes',
        paragraphs: [
          'Under-fuelling hard sessions in an attempt to lose weight is the most common one: the session goes badly, you eat more later anyway, and recovery suffers. Keep your deficit on easy days instead.',
          'Another is relying on "sports" snacks for everyday workouts. For a 45-minute gym session, a normal meal before and after is all you need.',
          'Finally, alcohol after training slows rehydration and recovery. One beer with the group after a ride is a social ritual worth keeping — just have water and a proper meal with it.',
        ],
      },
    ],
  },
  {
    slug: 'find-training-partners',
    title: 'How to Find Training Partners — and Keep Training Together',
    description: 'Where to find people to run, ride or work out with, how to match pace and goals, what to agree on, and how to stay safe when meeting someone new.',
    updatedAt: '2026-10-26',
    readTime: 6,
    category: 'Community',
    sections: [
      {
        paragraphs: [
          'Training with others is one of the most reliable ways to stay consistent. A partner who is waiting at 7 am makes it much harder to skip the session, and group sessions push you to efforts you wouldn\'t manage alone. Here is how to find the right people and keep it going.',
        ],
      },
      {
        heading: 'Where to Look',
        paragraphs: [
          'Local clubs are the classic answer: running clubs, cycling clubs, triathlon clubs and hiking associations all run regular group sessions, often for different levels. Many offer a free trial session.',
          'Shops and gyms are good meeting points too — bike and running shops often host weekly group rides or runs. Event apps and local social groups help you find spontaneous sessions nearby, which is ideal when your schedule changes from week to week.',
          'Don\'t forget people you already know: colleagues, neighbours and friends who have mentioned wanting to get fitter. A regular lunchtime walk or Saturday ride can start with one message.',
        ],
      },
      {
        heading: 'Match Pace and Goals',
        paragraphs: [
          'The best partners are at a similar level and want a similar session. If one of you is training for a marathon and the other wants a relaxed jog, someone will end up frustrated.',
          'Before the first session, agree on distance, pace and the type of session in concrete terms: "10 km easy at about 6:00/km" or "60 km ride at an average around 25 km/h with a coffee stop". For groups, say clearly whether it is a no-drop session — meaning nobody gets left behind.',
        ],
      },
      {
        heading: 'Make It a Habit',
        paragraphs: [
          'Consistency beats intensity. A fixed weekly slot — same day, time and starting point — survives busy weeks much better than sessions planned from scratch every time.',
          'Keep the communication simple: one group chat or event per session, a clear start time, and a rule that people say early if they can\'t make it. Celebrate small milestones together: a first 10 km, a new climb, a season\'s total distance.',
        ],
      },
      {
        heading: 'Stay Safe When Meeting Someone New',
        paragraphs: [
          'Meet in a public, busy place for the first time, and tell a friend where you are going and when you expect to be back. Share your live location for longer or remote sessions.',
          'Stick to routes you know until you know the people, and trust your instincts — it is always fine to cut a session short or leave. Good apps and clubs let you report and block people who behave inappropriately; use those tools.',
        ],
      },
    ],
  },
  {
    slug: 'group-ride-and-group-run-etiquette',
    title: 'Group Ride and Group Run Etiquette: A Practical Guide',
    description: 'Hand signals, riding in pairs, holding a steady pace, waiting at the top and the unwritten rules that make group sessions safe and fun for everyone.',
    updatedAt: '2026-10-26',
    readTime: 6,
    category: 'Community',
    sections: [
      {
        paragraphs: [
          'Group sessions are where a lot of the fun in endurance sport happens — and where most avoidable crashes and frustrations happen too. A few shared rules make the difference.',
        ],
      },
      {
        heading: 'Before You Start',
        paragraphs: [
          'Arrive a few minutes early with your equipment ready: tyres pumped, chain lubed, bottles full, phone charged, lights if it might get dark. Bring what you need to fix a puncture yourself.',
          'Listen to the briefing. The organiser should say the route, the planned pace, regroup points and whether it is a no-drop ride or run. If you are new, say so — people will look out for you.',
        ],
      },
      {
        heading: 'On the Bike',
        paragraphs: [
          'Ride predictably. Hold your line, avoid sudden braking, and don\'t overlap your front wheel with the rear wheel of the rider in front — a touch of wheels is the most common cause of group crashes.',
          'Point out hazards: holes, gravel, glass and parked cars, with a hand signal or a call. Signal before turning or stopping. Riders at the back call "car back" when a vehicle approaches from behind; riders at the front warn of oncoming traffic.',
          'When taking a turn at the front, keep the pace the group had — not faster. Surging on the front splits the group and wears everyone out. Follow local traffic rules on riding two abreast and single out when the road narrows or traffic builds.',
        ],
      },
      {
        heading: 'On the Run',
        paragraphs: [
          'Run at most two or three abreast on shared paths and move into single file when others come towards you. Keep to the agreed pace in the group — save your race effort for the planned intervals.',
          'On out-and-back routes or loops, faster runners can turn back to collect slower ones, which keeps the group together without anyone waiting in the cold.',
        ],
      },
      {
        heading: 'Regroup and Look After Each Other',
        paragraphs: [
          'Wait at the top of climbs and at junctions so nobody misses a turn. If someone has a mechanical or feels unwell, the group stops; no-drop means no-drop.',
          'Be friendly to other road and path users. Every group represents everyone else who rides or runs in that area.',
        ],
      },
      {
        heading: 'Afterwards',
        paragraphs: [
          'Thank the organiser, share photos or the route if the group likes that, and say if you\'ll come next time — it helps people plan. The coffee or beer afterwards is optional, but it is often where a group turns into a community.',
        ],
      },
    ],
  },
]

export function getGuide(slug: string): Guide | undefined {
  return guides.find((g) => g.slug === slug)
}
