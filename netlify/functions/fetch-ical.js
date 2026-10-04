export default async function handler(event) {
  const url = event.queryStringParameters?.url

  if (!url) {
    return new Response(JSON.stringify({ 
      error: 'Missing url parameter',
      received: JSON.stringify(event.queryStringParameters),
      fullEvent: JSON.stringify(Object.keys(event))
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.text()

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar',
        'Access-Control-Allow-Origin': '*',
      }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}