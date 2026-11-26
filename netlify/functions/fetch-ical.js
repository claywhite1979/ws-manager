// Maps a short feed name to the server-only environment variable
// that holds the real calendar address.
const FEEDS = {
  airbnb: 'AIRBNB_ICAL_URL',
  vrbo: 'VRBO_ICAL_URL',
}

const json = (body, status) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export default async function handler(req) {
  const { searchParams } = new URL(req.url)
  const feed = searchParams.get('feed')

  // Only the two names above are accepted. No arbitrary URLs.
  const envName = FEEDS[feed]
  if (!envName) return json({ error: 'Unknown feed' }, 400)

  const url = process.env[envName]
  if (!url) {
    console.error(`Missing ${envName}`)
    return json({ error: 'Feed not configured' }, 500)
  }

  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.text()
    return new Response(data, {
      status: 200,
      headers: { 'Content-Type': 'text/calendar' },
    })
  } catch (err) {
    console.error('Feed fetch failed:', err.message)
    return json({ error: 'Could not fetch the calendar feed' }, 500)
  }
}