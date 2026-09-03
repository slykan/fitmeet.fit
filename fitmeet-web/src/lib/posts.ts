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
    slug: 'route-poi-markers-beer-coffee-viewpoint',
    title: 'Mark the Beer Stop, the Viewpoint, and Every Break on Your Route',
    description: 'Route drawing now has five FitMeet-only markers — beer, coffee, cigarette, pause and viewpoint — so organisers can flag exactly where the group will stop, on both web and mobile.',
    publishedAt: '2026-09-02',
    readTime: 3,
    category: 'Routes',
    sections: [
      {
        heading: 'A Route Is More Than Just a Line',
        paragraphs: [
          'A GPX track tells you where to go, but not what actually happens along the way. Every regular group ride or run has its own unwritten map of stops: the bar at the halfway point, the bench with the view, the spot everyone takes a smoke break. None of that shows up on a route until now.',
          'Route drawing on FitMeet has five new markers you can drop directly on the line while you build a route: beer, coffee, cigarette, pause and viewpoint. They are FitMeet-only annotations, not part of the underlying track, so they layer useful context on top of a route without touching the GPX itself.',
        ],
      },
      {
        heading: 'Five Markers, One Tap',
        paragraphs: [
          'While drawing a route, a small palette button opens the five icons — 🍺 beer, ☕ coffee, 🚬 cigarette, 🕐 pause and 🔭 viewpoint. Pick one, tap the spot on the map, and it drops right there. Tap a placed marker again to remove it. On the web draw screen you can drag icons straight from the palette onto the map instead.',
          'Viewpoint is the newest addition, for the lookout or scenic stop that is worth flagging even when nobody is stopping for a drink — the same placement flow as the other four, on both web and the native mobile route builder.',
        ],
      },
      {
        heading: 'Draw It Once, See It Everywhere',
        paragraphs: [
          'Markers are saved with the route and show up read-only wherever that route appears — its own route page, and any event page that has the route attached — on web, Android and iOS. Anyone checking a route before joining can see at a glance where the group is planning to stop, not just how far they are riding.',
          'They stay out of the GPX file on purpose. Export a route to Garmin, Wahoo or any navigation app and you get a clean track — the beer stops are a FitMeet layer, not baggage on your device.',
        ],
      },
      {
        heading: 'Available Now',
        paragraphs: [
          'Route POI markers are live today on fitmeet.fit and in the Android and iOS apps. Open the route builder, tap the + palette, and mark the stops that make your route worth doing.',
        ],
      },
    ],
  },
  {
    slug: 'fitmeet-live-location-sharing',
    title: 'See Everyone Live on the Map During Group Rides and Runs',
    description: 'Opt in after checking in to an event and share your live position with the group — see where everyone is in real time, their speed, a safety signal if someone stops, and never lose the pack, even if your phone is locked.',
    publishedAt: '2026-08-22',
    readTime: 4,
    category: 'Safety',
    sections: [
      {
        heading: 'Never Lose the Group Again',
        paragraphs: [
          'Anyone who has organised a group ride or run knows the problem: the pack splits on a climb, someone takes a wrong turn, and suddenly nobody knows where anyone else is. Until now, FitMeet showed you the route — but not where your group actually was on it.',
          'That changes today. During an event, checked-in participants can share their live position with everyone else who is also checked in, right on the same map you already use for the route.',
        ],
      },
      {
        heading: 'Opt In After You Check In',
        paragraphs: [
          'Live sharing is off by default and always your choice. Check in to an event and FitMeet asks if you want to share your position for the rest of the event — nothing is sent before you say yes, and you can turn it off again at any time from the check-in card.',
          'Sharing is scoped to that one event too: saying yes at one ride does not carry over and quietly enable it at the next one.',
        ],
      },
      {
        heading: 'Live Positions, Speed and Smart Grouping',
        paragraphs: [
          'Everyone sharing shows up on the map with their photo (or initials if they have not set one) and current speed, updating automatically while the event is live. When a few of you are riding or running close together, FitMeet groups those markers into a single badge instead of stacking pins on top of each other — tap it to see exactly who is in the group.',
        ],
      },
      {
        heading: 'A Safety Signal If Someone Stops',
        paragraphs: [
          'Live tracking is not just about knowing where the pack is — it is also a lightweight safety net. If someone stops moving for about a minute, whether they pulled over, got a flat, or something worse, their marker gets a pulsing red ring on the map instead of the usual green, so the rest of the group can spot it at a glance and go check on them.',
          'This is a simple, approximate signal based on position, not a real crash detector — but it turns "does anyone know where Marko is?" into something you can see immediately instead of finding out an hour later. Custom alerts and notifications built on top of this — so the group gets pinged automatically instead of having to notice it themselves — are coming in a future update.',
        ],
      },
      {
        heading: 'Works Even When Your Phone Is Locked',
        paragraphs: [
          'Positions keep updating while your phone is locked or tucked in a jersey pocket, not just while the app is open — FitMeet asks for background location access up front so it can keep sharing without you having to keep the screen on.',
          'On some Android phones, aggressive battery managers can pause background apps regardless. If that happens, FitMeet will prompt you to exempt it from battery optimization so tracking stays reliable for the whole ride.',
        ],
      },
      {
        heading: 'Available Now',
        paragraphs: [
          'Live location sharing is rolling out today on Android, with the map viewable on fitmeet.fit as well for anyone following along from a laptop. Update the app, join an event, check in, and give it a try on your next group ride or run.',
        ],
      },
    ],
  },
  {
    slug: 'fitmeet-training-sync-strava',
    title: 'Your Strava Trainings Now Sync Automatically Into FitMeet',
    description: 'Connect Strava once and every run, ride or workout shows up in FitMeet automatically — categorized, deduplicated, and packed with heart rate, power, cadence and pace. Garmin and Huawei Health are next.',
    publishedAt: '2026-07-21',
    readTime: 4,
    category: 'Training',
    sections: [
      {
        heading: 'One Place for Every Training, Not Just Events',
        paragraphs: [
          'FitMeet has always been about the events you join and organise. But most people training for those events are also logging solo runs, rides and gym sessions somewhere else — usually Strava. Until now, that history lived in a completely separate app with no connection to FitMeet at all.',
          'That changes today. Connect your Strava account once, and every training you record shows up automatically in FitMeet — no manual import, no copy-pasting a screenshot into a group chat.',
        ],
      },
      {
        heading: 'Connect Once, Sync Forever',
        paragraphs: [
          'Head to Profile → Connected apps and connect Strava. FitMeet immediately pulls in your recent training history, then stays in sync in real time from that point on — a Strava webhook notifies FitMeet the moment you finish a new activity, so it typically appears within seconds, not after some overnight batch job.',
          'Disconnecting is just as simple, and your already-synced history stays in your FitMeet log either way — nothing gets deleted just because you unlink an account.',
        ],
      },
      {
        heading: 'Categorized and Fully Detailed',
        paragraphs: [
          'Every synced training is automatically mapped onto the same sport categories FitMeet already uses for events — running, cycling, hiking, swimming, fitness and more — so it fits right alongside everything else in the app.',
          'It is not just a title and a distance either. Where Strava has the data, FitMeet shows it: average and max heart rate, power in watts, cadence, calories, pace or speed depending on the sport, elevation gain, relative effort, even the gear you used and any notes you added. It is all there under a "Show details" toggle on each training, so the summary stays clean but the full picture is one tap away.',
        ],
      },
      {
        heading: 'A New Log Tab, With Filters and Totals',
        paragraphs: [
          'Trainings live in a new tab under Meet, filterable by category, month and year. Filter down to "Cycling, July" and a totals strip above the list adds up your distance, time, elevation and calories for exactly that slice — and it only shows the numbers that make sense for what you filtered, so a month of swims will not show a bogus elevation total.',
          'Get a notification the moment a new training lands, too — a "New training synced" alert shows up right in your Alerts, tapping it drops you straight into the Log tab to see it.',
        ],
      },
      {
        heading: 'Built to Handle More Than One Source',
        paragraphs: [
          'Strava is live today, but it will not be the only source for long — Garmin Connect and Huawei Health are next on the roadmap. FitMeet already has the groundwork in place for that: if the same training ever ends up reported by two connected providers, it gets matched and merged instead of showing up twice, and you decide which provider wins by ranking them in Connected apps.',
        ],
      },
      {
        heading: 'Available Now',
        paragraphs: [
          'Strava sync is live today on fitmeet.fit, rolling out to the Android and iOS apps in the next update. If you train on Strava, connecting it takes about ten seconds — and from then on, FitMeet just stays current.',
        ],
      },
    ],
  },
  {
    slug: 'fitmeet-block-report-trust-and-safety',
    title: 'Report, Block and Stay in Control: New Trust & Safety Tools on FitMeet',
    description: 'FitMeet now lets you report and block other members directly from events, messages, moments and the marketplace, backed by an admin review team and a Terms of Service you accept at sign-up.',
    publishedAt: '2026-07-08',
    readTime: 3,
    category: 'Safety',
    sections: [
      {
        heading: 'Why We Built This',
        paragraphs: [
          'FitMeet works because strangers can meet up for a run, a ride or a hike and trust the person on the other side of the app. As the community grows, we wanted the same tools you would expect from any social platform: a simple way to report something that is not okay, and a way to block someone you would rather not interact with — no explanation required.',
          'This was also part of what Apple asked for before approving the iOS app: a clear content-moderation loop with reporting, blocking and admin review. We used it as a reason to build it properly, not just to tick a box.',
        ],
      },
      {
        heading: 'Report Anything, From Anywhere',
        paragraphs: [
          'You can now report a user, an event, a comment, a marketplace listing or a direct message straight from where you see it — no digging through settings. Pick a reason, add a short note if you want, and submit. Reports go straight to a dedicated admin review queue.',
          'We deliberately made reporting available in every place people actually interact on FitMeet: event pages, moments, chats and the marketplace. A safety tool that only works in one corner of the app does not get used.',
        ],
      },
      {
        heading: 'Block Someone, Instantly',
        paragraphs: [
          'Blocking a user hides their profile, stops them from messaging you, and removes friction from any shared spaces without you needing to justify the decision to anyone. It works the same way on Android, iOS and the web.',
          'The block button lives right in the chat header and on profiles, and it now toggles cleanly — block someone, and it becomes an unblock option in the same place if you ever change your mind.',
        ],
      },
      {
        heading: 'Behind the Scenes: Admin Review',
        paragraphs: [
          'Every report lands in an admin dashboard where our team can see the content in context, take action — including banning an account when it is warranted — and keep the community clean without relying on public callouts or drama.',
          'We also added a content filter that flags obviously inappropriate text automatically, and a Terms of Service step at registration so everyone joining FitMeet agrees to the same ground rules from day one.',
        ],
      },
      {
        heading: 'Available Now',
        paragraphs: [
          'Reporting, blocking and the Terms of Service gate are live today on Android, iOS and fitmeet.fit. If you ever run into something that should not be on FitMeet, reporting it takes a few seconds — and it genuinely gets looked at.',
        ],
      },
    ],
  },
  {
    slug: 'fitmeet-ios-app-coming-to-app-store',
    title: 'FitMeet is Coming to the App Store — iOS App Submitted for Review',
    description: 'The FitMeet iOS app is complete and has been submitted to the Apple App Store. We are waiting for Apple\'s approval. Every feature from the Android app is here — and a few iOS extras on top.',
    publishedAt: '2026-07-01',
    readTime: 2,
    category: 'Community',
    sections: [
      {
        heading: 'Submitted. Waiting for Apple.',
        paragraphs: [
          'The FitMeet iOS app is done. It has been submitted to the Apple App Store and is currently in review. Once approved, it will be available for free download on iPhone.',
          'We have been running on Android since April. The iOS version is a full parity release — every feature that exists on Android is in the iOS app. Map with live event markers, route builder, GPX export, marketplace, messaging, check-ins, and activity tracking.',
        ],
      },
      {
        heading: 'What to Expect on iOS',
        paragraphs: [
          'Sign in with Apple, Google, Strava or email. Discover events nearby on a live map. Create your own in under a minute. Invite friends or leave it open for anyone to join.',
          'The route builder lets you draw point-to-point routes with road snapping, see surface mix and elevation, and export to GPX for Garmin, Wahoo or any navigation app. The marketplace works too — browse and post sports gear listings from your phone.',
          'Push notifications, friend requests, event reminders and group messaging are all there. The app is fully dark-themed and designed for one-handed use.',
        ],
      },
      {
        heading: 'Get Notified When It Drops',
        paragraphs: [
          'Apple reviews typically take a few days. We expect the app to go live very soon. Sign up for a free FitMeet account on the web now — your account carries over to iOS automatically. No re-registration needed.',
          'If you are already on Android, nothing changes. If you have been waiting for iOS — it is almost here.',
        ],
      },
    ],
  },

  {
    slug: 'fitmeet-marketplace-buy-sell-sports-gear',
    title: 'Introducing the FitMeet Marketplace: Buy and Sell Sports Gear Within Your Community',
    description: 'FitMeet now has a built-in marketplace for sports gear. List what you no longer use, find what you need, and deal directly with people from your local sports community.',
    publishedAt: '2026-06-16',
    readTime: 3,
    category: 'Community',
    sections: [
      {
        heading: 'Sports Gear That Goes to the Right People',
        paragraphs: [
          'Most sports gear spends more time in a cupboard than on a bike, trail or court. A pair of cycling shoes that no longer fit. A wetsuit after the triathlon season. Ski boots collecting dust until next winter. The FitMeet Marketplace is a place to move that gear on — and find what you need — without leaving the community you are already part of.',
          'Listings are posted by real athletes: people who run, ride, hike and train. That context matters. Someone selling a road bike has actually ridden it. Someone looking for a size 43 trail shoe knows what they are asking for.',
        ],
      },
      {
        heading: 'Sell What You Have. Find What You Need.',
        paragraphs: [
          'Selling is straightforward: pick a category, add photos (up to five), set a price, choose the condition — new, like new, or used — and post. Listings go live immediately and are visible to anyone on FitMeet.',
          'If you are looking for something specific, post a buy request instead. A "wanted" listing lets others know what you are after, with an optional max budget. It works for niche items that rarely appear on general second-hand platforms — specific race kit, older component standards, discontinued footwear.',
        ],
      },
      {
        heading: 'Filtered by Category, Condition and Type',
        paragraphs: [
          'The marketplace is organised with the same categories as FitMeet events: running, cycling, hiking, fitness, yoga, climbing, and the rest. Filter by sell or buy listings, narrow to a condition, and search by title or description if you know what you are looking for.',
          'Listings show location based on where sellers are based, so you can see at a glance whether something is local or further away. Contacting a seller goes through the existing FitMeet messages system — no external accounts, no public phone numbers.',
        ],
      },
      {
        heading: 'Available on Web and Android',
        paragraphs: [
          'The marketplace is available now on fitmeet.fit under the Meet tab, and in the Android app. Creating a listing, browsing and messaging sellers all work from both platforms.',
          'iOS support is coming. If you have gear to move or something you have been looking for, the marketplace is open.',
        ],
      },
    ],
  },

  {
    slug: 'route-surface-mix-event-updates',
    title: 'Route Surface Mix, Better GPX Views and Cleaner Event Planning',
    description: 'FitMeet route and event pages now show road surface mix, GPX-linked photos, uphill/downhill details, and better route drawing tools for planning rides, runs and hikes.',
    publishedAt: '2026-06-07',
    readTime: 3,
    category: 'Routes',
    sections: [
      {
        heading: 'Road Surface Mix on Routes and Events',
        paragraphs: [
          'Routes are more useful when you know what kind of ground is waiting for you. FitMeet now analyses GPX routes with OpenStreetMap road data and shows the surface mix directly on route and event views.',
          'That means a route can show something like 10% paved road, 70% unpaved road and 20% trail before people commit to it. The map also uses different line styles so paved roads, gravel, trails and unknown sections are easier to tell apart at a glance.',
        ],
      },
      {
        heading: 'GPX Details Are Easier to Read',
        paragraphs: [
          'Route and event views now show more of the numbers organisers and participants actually care about: distance, elevation gain, max uphill grade, max downhill grade, uphill kilometres and downhill kilometres.',
          'The goal is to make a GPX route understandable without opening another app. Someone joining a ride or hike should be able to see whether it is mostly flat, climb-heavy, road-focused or more adventurous.',
        ],
      },
      {
        heading: 'Photos Follow the Route',
        paragraphs: [
          'GPX route photos are now tied to the route itself. When a route passes near useful public photo locations, FitMeet can show those images on route and event views so the page feels less abstract than a line on a map.',
          'For organisers, that makes shared routes easier to sell. For participants, it gives a quick sense of the place before they show up.',
        ],
      },
      {
        heading: 'Route Drawing Is Getting More Practical',
        paragraphs: [
          'The route creation screen has been tightened up with better controls for distance and elevation, current-location support, place search, and an elevation profile while drawing. These changes make route planning less like hunting around a blank map and more like building the route you actually want to share.',
          'Together with GPX download and reusable FitMeet routes, this makes the route flow stronger from first draft to final event page.',
        ],
      },
    ],
  },

  {
    slug: 'gpx-routes-create-download-share',
    title: 'Create, Download and Share GPX Routes for Free',
    description: 'Draw routes on the map point by point, export as GPX, send to your Garmin or Wahoo, and share route pages with friends — all from FitMeet for free.',
    publishedAt: '2026-05-28',
    readTime: 3,
    category: 'Routes',
    sections: [
      {
        heading: 'Draw the Route Yourself',
        paragraphs: [
          'FitMeet now has a full route builder built into the app and the web. Click points on the map and the route snaps to real roads and trails — no manual tracing needed. Distance and elevation update live as you place each point. Move a waypoint, delete it, or undo the last step to refine the line.',
          'When you are done, name the route, pick the sport category, and decide whether to keep it private or publish it to the FitMeet route library for others to find.',
        ],
      },
      {
        heading: 'Download as GPX — Works Everywhere',
        paragraphs: [
          'Every route in FitMeet can be downloaded as a GPX file. GPX is the universal format for GPS devices and navigation apps. Once you have the file, import it directly into Garmin Connect, Wahoo Elemnt, Komoot, AllTrails, Strava, OsmAnd, or any smartphone navigation app.',
          'You create the route once and it works on every device you already use. No conversion, no subscriptions, no locked file formats.',
        ],
      },
      {
        heading: 'Share With Friends Before the Event',
        paragraphs: [
          'Every public route has its own shareable page with the route on the map, the elevation chart, and the key stats. Send the link in a message or post it to a group so people know the route, the distance and the climb before they leave home.',
          'When organising an event, attach an existing FitMeet route instead of uploading a new GPX. The same route can be reused across events without duplicating the file.',
        ],
      },
      {
        heading: 'Send to Your Device',
        paragraphs: [
          'Download the GPX file from any route detail page and import it to your navigation device. The flow is the same on Garmin Edge, Garmin Forerunner, Wahoo Elemnt and Bolt, Hammerhead Karoo, and all major GPS watches.',
          'On a phone, open the GPX file directly in Komoot, Organic Maps, Maps.me or your preferred app. The route loads immediately with the full track visible.',
        ],
      },
    ],
  },

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
