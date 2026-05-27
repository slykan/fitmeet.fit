export interface PostSection {
  heading?: string
  paragraphs: string[]
}

export interface Post {
  slug: string
  title: string
  description: string
  publishedAt: string
  readTime: number
  category: string
  sections: PostSection[]
}

export const posts: Post[] = [
  {
    slug: 'fitmeet-routes-gpx-event-planning',
    title: 'FitMeet Routes: Share, Download and Reuse GPX Routes',
    description: 'Routes now have their own place in FitMeet: browse public GPX routes, open route detail pages, download files, share links, and reuse routes when creating or editing events.',
    publishedAt: '2026-05-27',
    readTime: 4,
    category: 'Routes',
    sections: [
      {
        heading: 'Routes Are No Longer Hidden Inside Events',
        paragraphs: [
          'A good route should not disappear after the event date passes. Public events with GPX routes now help build a route library inside FitMeet, so people can browse past and upcoming routes in one place.',
          'The Routes tab in Meet shows the core details people care about before joining or planning something new: category, distance, elevation, route shape and the location context. It turns public GPX uploads into a useful archive, not just an attachment on one event.',
        ],
      },
      {
        heading: 'Open the Route, See the Map and Elevation',
        paragraphs: [
          'Route detail pages now feel closer to the event route view: map, elevation chart, distance, elevation gain, and grade information live together. That makes it easier to judge whether a route is a relaxed social loop, a proper climb, or something you want to save for later.',
          'The goal is simple: when someone shares a route, the person opening it should understand the activity before they even join an event.',
        ],
      },
      {
        heading: 'Share the Page or Download the GPX',
        paragraphs: [
          'Every route detail page has sharing built in, so you can send the route link to a friend or group without exporting anything first. If someone needs the raw file, GPX download is there too.',
          'That matters for watches, bike computers, map apps and offline planning. FitMeet can be the social layer, while the GPX file still works wherever people already navigate.',
        ],
      },
      {
        heading: 'Create and Edit Events From Saved Routes',
        paragraphs: [
          'When creating or editing an event, you can now add a route from existing FitMeet routes. Instead of uploading the same GPX again and again, pick the route, preview it, and attach it to the event.',
          'FitMeet keeps the original public route clean, avoids duplicating route records, and still lets the event show the same distance, elevation and route preview participants expect.',
        ],
      },
      {
        heading: 'Cleaner Route Editing',
        paragraphs: [
          'Event route editing is now more deliberate. You can replace a route, import one from the FitMeet route library, or delete the route from an event when it no longer belongs there.',
          'That gives organisers more freedom to refine an event after publishing it, while keeping the route archive useful for everyone.',
        ],
      },
    ],
  },

  {
    slug: 'how-to-organize-a-group-run',
    title: 'How to Organize a Group Run (Without It Falling Apart)',
    description: 'Step-by-step guide to planning a group run that people actually show up to — from picking the route to keeping everyone in sync on the day.',
    publishedAt: '2026-04-10',
    readTime: 5,
    category: 'Running',
    sections: [
      {
        heading: 'Start With a Route That Works for Everyone',
        paragraphs: [
          'The biggest reason group runs fall apart before they start is a poor route choice. Picking something too ambitious loses beginners; too easy frustrates regulars. The sweet spot is a flat to moderate route between 5 and 8 kilometres with a clear meeting point — somewhere with parking, a coffee shop nearby, or a visible landmark.',
          'Share the route before the day. Drop a GPX file or a map link so people know what they are signing up for. "We are doing a run" is less convincing than "7km along the river, 60 metres elevation, back in about 45 minutes." The more information you give upfront, the better people prepare — and the fewer last-minute dropouts you get.',
        ],
      },
      {
        heading: 'Pick a Time and Stick to It',
        paragraphs: [
          'Consistency is the secret to a running group that lasts. Weekend mornings — Saturday at 8am, Sunday at 9am — work for most people. Evening runs on Tuesday or Thursday at 6:30pm suit working adults. What matters less is the exact time; what matters is that it never changes.',
          'A group that meets every Saturday at 8am, rain or shine, becomes a habit. A group that meets "whenever enough people can make it" disappears within a month. Pick a slot, publish it, and treat it like an appointment you cannot cancel.',
        ],
      },
      {
        heading: 'Set Pace Expectations Clearly',
        paragraphs: [
          'Nothing poisons a group run faster than showing up expecting a social jog and finding yourself dropped in the first kilometre. Be honest about pace when you promote the run. "Conversational pace, around 6:30/km" tells people more than "beginner-friendly." Experienced runners can always slow down; beginners who struggle to keep up usually stop coming back.',
          'If your group has a range of abilities, split into pace groups. Two groups — one at 5:30/km and one at 6:30/km — keeps everyone comfortable and doubles the social connections you build.',
        ],
      },
      {
        heading: 'Use a Group Wall for Last-Minute Updates',
        paragraphs: [
          'Weather changes, a meeting point floods, someone finds a better route — things come up. A dedicated space for group communication means everyone gets the update before they leave home. Send a reminder the evening before. A simple "See you at 8am tomorrow — weather looks good" dramatically improves turnout.',
          'Apps built for local sport events, like FitMeet, give every event its own comment wall where organiser and participants can post updates without the clutter of a general group chat. Participants who are confirmed for the run see the message; people who are not coming do not.',
        ],
      },
      {
        heading: 'End Somewhere',
        paragraphs: [
          'The best group runs end somewhere — a coffee spot, a juice bar, a bench with a view. The run is the workout; the thirty minutes after are where the community actually forms. People remember who they talked to over a coffee far longer than the route they ran.',
          'If you want people returning week after week, give them a reason to stay for those last few minutes. It sounds minor. It is not.',
        ],
      },
    ],
  },

  {
    slug: 'group-workouts-vs-solo-training',
    title: '5 Reasons Group Workouts Beat Solo Training',
    description: 'From accountability to pushing harder without noticing — the science and practice behind why training with others consistently outperforms going it alone.',
    publishedAt: '2026-04-18',
    readTime: 5,
    category: 'Fitness',
    sections: [
      {
        heading: 'You Actually Show Up',
        paragraphs: [
          'The biggest advantage of group training has nothing to do with exercise science. It is simpler: you are less likely to skip. When someone is waiting for you at 7am, the mental calculation changes. The cost of bailing is no longer just a missed workout — it is letting someone down.',
          'Research backs this up. Studies on exercise adherence consistently find that social commitment is the single most effective predictor of workout frequency — more reliable than motivation, goal-setting, or any training app. You do not need a formal arrangement to trigger it. You just need another person expecting you.',
        ],
      },
      {
        heading: 'You Push Harder Without Realising It',
        paragraphs: [
          'Sports psychologists call it social facilitation: the presence of others improves performance on well-learned tasks. In practical terms, you run faster when someone is beside you. You hold the pace for the last kilometre instead of dropping off because the group is still moving.',
          'This effect is unconscious and consistent. You do not have to be competitive to experience it. Simply being in motion alongside other people raises your effort level by roughly 10 to 20 percent on aerobic tasks. The group sets the floor — and most people stay above it.',
        ],
      },
      {
        heading: 'You Learn Faster',
        paragraphs: [
          'Solo training puts a ceiling on technique improvement. You repeat what you already know. Group training exposes you to how other people move, warm up, pace themselves, and recover. You pick up the breathing pattern of the runner next to you. You notice that the cyclist ahead sits differently on climbs. You ask the question you would never think to Google.',
          'Informal knowledge transfer in group settings is underrated. Most people credit a person, not a video or an article, for the habit or technique that actually changed their results.',
        ],
      },
      {
        heading: 'The Time Goes Faster',
        paragraphs: [
          'A 10km solo run can feel long. The same distance with a few friends feels like it ended too soon. This is not imagination — attention directed outward competes with attention directed inward. When your mind is engaged with other people, the signals that tell you to slow down get less airtime.',
          'For anyone building a consistent fitness habit, this matters enormously. Activities that feel good in the moment get repeated. Activities that feel like a grind get postponed and eventually dropped.',
        ],
      },
      {
        heading: 'You Build Something That Lasts',
        paragraphs: [
          'The long-term value of group training is not just fitness — it is the relationships. People who train together regularly develop a specific kind of trust: they have seen each other tired, in bad weather, on difficult days. That shared context creates real friendships faster than most social settings.',
          'A training group that meets consistently for six months becomes self-sustaining. People come back not just for the workout but for each other. The fitness is the entry point. The community is what keeps people coming for years.',
        ],
      },
    ],
  },

  {
    slug: 'find-cycling-partners',
    title: 'How to Find Cycling Partners in Your City',
    description: 'Where to look, what to expect, and how to make the most of your first group ride — a practical guide to finding people to cycle with locally.',
    publishedAt: '2026-04-25',
    readTime: 5,
    category: 'Cycling',
    sections: [
      {
        heading: 'Why Riding With Others Changes Everything',
        paragraphs: [
          'Cycling alone is meditative. Cycling with others is motivating. The difference becomes clear on climbs: a group pulls you through hills you would have slowed down on solo, the pace stays honest on the flats, and the post-ride conversation turns a workout into an event.',
          'The challenge is finding people who ride at a similar pace and have compatible schedules. Once you find the right group, going back to riding alone exclusively feels quieter than it used to. Here is where to look.',
        ],
      },
      {
        heading: 'Local Cycling Clubs',
        paragraphs: [
          'Most cities have at least one cycling club, and many have several — divided by discipline (road, gravel, MTB), speed, or geography. Clubs typically post their ride schedules publicly and run beginner-friendly sessions. A search for your city plus "cycling club" usually returns a website or active social group with upcoming rides.',
          'The advantage of clubs is structure: regular rides, experienced leaders, a ready-made community. The disadvantage can be pace — some clubs run at a competitive level that is uninviting for riders who are newer or more casual. Ask before you show up whether there is a social pace group.',
        ],
      },
      {
        heading: 'Local Bike Shops',
        paragraphs: [
          'Independent bike shops are often the hub of the local cycling scene in ways that do not show up online. Many organise or know about group rides that never get advertised elsewhere. Walk in, mention you are looking for people to ride with, and you will usually get pointed in the right direction.',
          'Some shops run their own weekly rides open to anyone who shows up — no membership, no commitment, just turn up with a roadworthy bike. These rides tend to be relaxed and social, which makes them a good starting point.',
        ],
      },
      {
        heading: 'Event Platforms Built for Local Sport',
        paragraphs: [
          'Apps and platforms built around local sport activity let people post and discover group rides the way you would post any event. The format is more flexible than a club: you can join a one-off ride for a specific route, find something that fits your schedule rather than committing to a weekly time, or post your own ride without the overhead of starting a formal group.',
          'FitMeet is one such platform — it lets riders attach a GPX route to an event listing, so participants know exactly what they are signing up for before they show up. For anyone new to an area, or with an unpredictable schedule, this kind of flexible discovery is often faster than finding a permanent group.',
        ],
      },
      {
        heading: 'What to Know Before Your First Group Ride',
        paragraphs: [
          'A few basics make group riding safer and more enjoyable for everyone. Signal before you brake. Call out road hazards — "hole left" or "car back" takes one second and prevents crashes. Do not overlap wheels with the rider in front. If you are unsure of the pace, start at the back and move forward gradually.',
          'If you are the one organising — share the GPX route and expected pace in the event details. Riders who know what they are signing up for arrive better prepared, ride with more confidence, and enjoy the experience more. That is how one ride becomes a group.',
        ],
      },
    ],
  },

  {
    slug: 'building-local-sports-community',
    title: 'Building a Local Sports Community: What Actually Works',
    description: 'The honest lessons from groups that grew and ones that did not — how to build something people keep showing up to.',
    publishedAt: '2026-05-02',
    readTime: 6,
    category: 'Community',
    sections: [
      {
        heading: 'Start Smaller Than You Think You Should',
        paragraphs: [
          'The impulse when starting a community is to go big — a launch event, a large invite list, a logo. Most communities that take this route get decent turnout for the first event and then struggle to recreate it. The ones that last almost always start small: three or four people, a regular time, no infrastructure.',
          'Small is sustainable. You can coordinate a four-person run over a text message. You adapt quickly. Social bonds form faster in small groups. And when more people arrive, they are joining something that already has a rhythm — which is far more appealing than joining something still trying to get started.',
        ],
      },
      {
        heading: 'Regularity Beats Scale',
        paragraphs: [
          'A community that meets every Tuesday at 7pm builds more trust and momentum than one that organises a major event once a month. Regularity makes the community a habit. People plan around it. They bring a friend because they know exactly what to tell them: "We meet every Tuesday at 7pm — you just show up."',
          'The events that grow communities are rarely the big ones. They are the unremarkable consistent ones that people can depend on. A Saturday morning ride that has happened thirty-two weeks in a row is worth more than four well-organised seasonal events.',
        ],
      },
      {
        heading: 'Welcome All Fitness Levels Explicitly',
        paragraphs: [
          'Most communities say they are welcoming. Fewer actually design for it. The difference shows in small decisions: is there a slower pace option? Is the route described so people can self-select? Does someone check in on newer members during the activity, or do they drift to the back unnoticed?',
          'People who show up for the first time are already doing something that takes effort. Meeting them where they are — not just in terms of fitness but in terms of belonging — determines whether they come back. A one-sentence welcome at the start of a session costs nothing and signals everything.',
        ],
      },
      {
        heading: 'Reduce Coordination Friction',
        paragraphs: [
          'The logistics of keeping a community running take up more organiser time than most people expect: communicating schedule changes, tracking who is coming, sharing routes, posting updates. Tools that reduce that friction directly increase how long organisers stick with it.',
          'Event platforms designed for local sports handle RSVP, route sharing, reminders, and group communication in one place. The less time an organiser spends on logistics, the more energy they have for what actually builds community — showing up and being present.',
        ],
      },
      {
        heading: 'Let People Lead',
        paragraphs: [
          'The healthiest communities are not dependent on one person. If only one person can organise a session, the community pauses every time they travel or get busy. The transition from "person running a group" to "community that organises itself" happens when others take on sessions.',
          'This does not happen automatically. It requires asking explicitly: "Would you lead Saturday\'s session?" Most people who have been part of a community for a while are willing. They just have not been asked.',
        ],
      },
    ],
  },

  {
    slug: 'plan-first-group-hike',
    title: 'How to Plan Your First Group Hike: A Practical Guide',
    description: 'From trail selection to what to send the night before — everything you need to organise a group hike that people want to do again.',
    publishedAt: '2026-05-10',
    readTime: 6,
    category: 'Hiking',
    sections: [
      {
        heading: 'Match the Trail to the Group, Not Your Ambition',
        paragraphs: [
          'The most common mistake on a first group hike is choosing a trail based on what you can handle rather than what the least fit person in the group can handle. One person struggling changes the dynamic for everyone — they feel guilty, the group either waits or fragments, and the person who chose the trail ends up apologising.',
          'Before choosing a route, ask two questions: what is the lowest fitness level in the group, and is everyone comfortable with the expected duration? A 12km hike with 400 metres of elevation may be routine for you and a genuine challenge for someone who walks recreationally a few times a year. Build in buffer time. What takes you three hours may take the group four and a half.',
        ],
      },
      {
        heading: 'Share the Route Before the Day',
        paragraphs: [
          'Send a GPX file or a link to the trail map before the hike. Include: total distance, elevation gain, expected duration, terrain type, and the difficulty rating. This lets people self-select, wear appropriate footwear, and have a rough sense of what lies ahead rather than discovering it mid-trail.',
          'A downloaded route also matters in areas with poor signal. Tools like Komoot or AllTrails let participants save routes offline. If you are using an event app to coordinate the hike, attaching the GPX to the event listing means everyone can grab it themselves without an extra message.',
        ],
      },
      {
        heading: 'Sort the Logistics Before They Become Problems',
        paragraphs: [
          'Trailhead logistics are where group hikes frequently get chaotic. Establish clearly: the exact meeting point as a GPS pin rather than a village name, the departure time and that everyone needs to be there on time, whether carpooling is expected, and what to do if someone cannot find the trailhead.',
          'For longer hikes, also clarify: is there a turn-back point if the weather changes? Who carries a first aid kit? Is there water on the trail or should everyone bring their own supply?',
        ],
      },
      {
        heading: 'Send a Simple Pack List the Night Before',
        paragraphs: [
          'Someone showing up in trainers with no water is a problem that a single message could have prevented. Keep the list short: sturdy footwear, layered clothing (weather changes at elevation faster than at the trailhead), at least 1.5 litres of water per person, snacks, a phone that is charged, and a portable battery for long days.',
          'People appreciate being told what to bring. Most are quietly relieved someone handled it — and arrive better prepared as a result.',
        ],
      },
      {
        heading: 'On the Trail, Stay as a Group',
        paragraphs: [
          'It is natural for faster hikers to pull ahead. Set the expectation in advance: the group waits at trail junctions, not along straight sections. This keeps everyone oriented without requiring the fastest to match the slowest the whole time.',
          'Designate someone to walk at the back — not as a consequence but as a specific role. It prevents anyone from ending up genuinely separated, and it gives someone a job that matters. End the hike with a moment to stop, look around, and acknowledge what the group just did. It sounds minor. It is what people remember.',
        ],
      },
    ],
  },
]

export function getPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug)
}
