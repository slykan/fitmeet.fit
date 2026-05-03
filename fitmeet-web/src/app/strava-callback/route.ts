import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const code  = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const deepLink = `fitmeet://strava-callback?code=${encodeURIComponent(code)}`

  const html = `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="refresh" content="0;url=${deepLink}">
<script>window.location.href = "${deepLink}";</script>
</head>
<body>
<p>Redirecting back to FitMeet...</p>
<a href="${deepLink}">Tap here if not redirected</a>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
}
