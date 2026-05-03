import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const code  = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Redirect back to mobile app with the auth code
  return NextResponse.redirect(`fitmeet://strava-callback?code=${code}`)
}
