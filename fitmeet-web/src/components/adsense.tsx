import Script from 'next/script'

// Google AdSense — only on pages with real publisher content (home, about, blog, guides, tools,
// help, public market). Never on app screens, share pages or near-empty pages: AdSense rejects
// sites that show ads on screens without content ("low value content").
export function AdSense() {
  return (
    <Script
      id="adsense"
      async
      strategy="afterInteractive"
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3054841074530422"
      crossOrigin="anonymous"
    />
  )
}
