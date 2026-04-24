export const mockEvents = [
  {
    id: '1',
    title: 'Sunrise Run on Bundek',
    category: 'Running',
    date: 'Sat, Apr 25',
    time: '08:00',
    location: 'Zagreb',
    attendees: 12,
    emoji: '🏃',
    cancelled: false,
  },
  {
    id: '2',
    title: 'Danube Gravel Session',
    category: 'Cycling',
    date: 'Sat, Apr 25',
    time: '10:30',
    location: 'Osijek',
    attendees: 8,
    emoji: '🚴',
    cancelled: false,
  },
  {
    id: '3',
    title: 'Easy Sunday Hike',
    category: 'Hiking',
    date: 'Sun, Apr 26',
    time: '09:15',
    location: 'Sljeme',
    attendees: 15,
    emoji: '🥾',
    cancelled: true,
  },
]

export const mockNotifications = [
  {
    id: 'n1',
    icon: 'mail-open-outline',
    title: 'New event near you',
    body: 'Morning pace run matches your running interest and region radius.',
    time: 'Just now',
  },
  {
    id: 'n2',
    icon: 'alarm-outline',
    title: 'Reminder sent',
    body: 'Your event reminder will go out before tonight’s ride.',
    time: '12 min ago',
  },
  {
    id: 'n3',
    icon: 'close-circle-outline',
    title: 'Event cancelled',
    body: 'Sunday hike stayed visible with cancelled status so nobody is left guessing.',
    time: '48 min ago',
  },
]

export const mockChats = [
  {
    id: 'c1',
    initials: 'MR',
    name: 'Morning Riders',
    preview: 'Let’s keep the 10:30 start and meet by the east entrance.',
    time: '09:12',
  },
  {
    id: 'c2',
    initials: 'AN',
    name: 'Ana Novak',
    preview: 'I joined the run. See you there.',
    time: 'Yesterday',
  },
  {
    id: 'c3',
    initials: 'ZH',
    name: 'Zagreb Hikers',
    preview: 'We should add the GPX link before sharing.',
    time: 'Yesterday',
  },
]
