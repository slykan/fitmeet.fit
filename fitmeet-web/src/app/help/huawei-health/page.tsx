import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/navbar'

export const metadata: Metadata = {
  title: 'Connect HUAWEI Health to FitMeet — iPhone & Android guide',
  description:
    'Step-by-step guide to syncing your HUAWEI Health trainings to FitMeet on iPhone and Android, and how to fix "Sync paused — action needed".',
}

const steps = {
  iphone: [
    'Open the HUAWEI Health app and sign in with the same HUAWEI ID you use to connect FitMeet.',
    'Go to Me › Third-party services and turn on HUAWEI Health Kit (link it if asked). On iPhone this switch lives here — not under Privacy.',
    'Make sure your health data syncs to the cloud: Me › Settings › Cloud sync (or Data sync) must be on. FitMeet can only read trainings that reached the HUAWEI cloud.',
    'In FitMeet open Trainings › Connected apps › HUAWEI Health, tap Connect (or Reconnect) and allow both "Activity record" and "Activity".',
  ],
  android: [
    'Open the HUAWEI Health app and sign in with the same HUAWEI ID you use to connect FitMeet.',
    'Go to Me › Privacy management and turn on HUAWEI Health Kit.',
    'Make sure cloud sync for your health data is on.',
    'In FitMeet open Trainings › Connected apps › HUAWEI Health, tap Connect (or Reconnect) and allow both "Activity record" and "Activity".',
  ],
}

const problems = [
  {
    title: '"Sync paused — action needed" / HUAWEI Health Kit is turned off',
    body: 'HUAWEI reports that Health Kit is off for your HUAWEI ID, so it shares no trainings with any app — even if you allowed all permissions when connecting. Turn on HUAWEI Health Kit (iPhone: Me › Third-party services, Android: Me › Privacy management), then tap Reconnect in FitMeet.',
  },
  {
    title: 'Connected, but my training doesn’t show up',
    body: 'Only trainings started as a workout (for example "Outdoor walk" › Start on your watch) are synced — everyday steps are not. Open the HUAWEI Health app and pull down to sync, so the training reaches the HUAWEI cloud. FitMeet checks every 15 minutes; tap Resync in Connected apps to check right away.',
  },
  {
    title: 'Not all permissions were granted',
    body: 'Training sync needs both "Activity record" and "Activity". Tap Reconnect and allow both.',
  },
  {
    title: 'Authorization was cancelled',
    body: 'Access was withdrawn in the HUAWEI Health app or on your HUAWEI ID. Tap Reconnect in FitMeet to authorize again.',
  },
]

export default function HuaweiHealthHelpPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 py-10">
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div className="mb-8">
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--primary)' }}>
              Help · Connected apps
            </p>
            <h1 className="text-4xl font-bold mb-4">Connect HUAWEI Health</h1>
            <p className="text-base leading-relaxed max-w-2xl" style={{ color: 'var(--text-muted)' }}>
              FitMeet reads your workout records from HUAWEI Health so your trainings appear in the Trainings tab
              automatically. The setting that allows this is in a different place on iPhone and on Android.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mb-10">
            {(['iphone', 'android'] as const).map((os) => (
              <section
                key={os}
                className="rounded-2xl border p-6"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <h2 className="text-xl font-semibold mb-4">{os === 'iphone' ? 'iPhone' : 'Android'}</h2>
                <ol className="space-y-3">
                  {steps[os].map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
                      <span
                        className="flex-none w-6 h-6 rounded-full grid place-items-center text-xs font-bold"
                        style={{ background: 'var(--primary)', color: '#000' }}
                      >
                        {i + 1}
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>

          <h2 className="text-2xl font-bold mb-4">Common problems</h2>
          <div className="space-y-4 mb-10">
            {problems.map((p) => (
              <section
                key={p.title}
                className="rounded-2xl border p-6"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <h3 className="text-lg font-semibold mb-2">{p.title}</h3>
                <p className="text-sm leading-7" style={{ color: 'var(--text-muted)' }}>{p.body}</p>
              </section>
            ))}
          </div>

          <section
            className="rounded-2xl border p-6 mb-10"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <h2 className="text-xl font-semibold mb-3">Alternative: sync through Strava</h2>
            <p className="text-sm leading-7" style={{ color: 'var(--text-muted)' }}>
              HUAWEI Health can share your workouts to Strava (Me › Third-party services › Strava). Connect Strava in
              FitMeet as well and your trainings arrive that way — FitMeet merges duplicates if both sources report the
              same training.
            </p>
          </section>

          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Still stuck? Write to <a href="mailto:support@fitmeet.fit" style={{ color: 'var(--primary)' }}>support@fitmeet.fit</a> or
            go back to your <Link href="/trainings" style={{ color: 'var(--primary)' }}>Trainings</Link>.
          </p>
        </div>
      </main>
    </>
  )
}
