// netlify/functions/job.js
// One endpoint for everything the cleaner job page needs.
// The browser sends: POST { token, action, ...details }
// This code runs on Netlify's servers with the Supabase SECRET key,
// so the browser never gets direct database access.

import { createClient } from '@supabase/supabase-js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const LEVELS = ['ok', 'low', 'out']
const ACTIVE = ['confirmed', 'in_progress']

// ---------- small helpers ----------

let _db
function getDb() {
  if (!_db) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SECRET_KEY
    if (!url) throw new Error('Missing SUPABASE_URL')
    if (!key) throw new Error('Missing SUPABASE_SECRET_KEY')
    _db = createClient(url, key, { auth: { persistSession: false } })
  }
  return _db
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

// An error we WANT the cleaner to see (as opposed to a crash).
class Refusal extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function need(job, allowedStatuses) {
  if (!allowedStatuses.includes(job.status)) {
    throw new Refusal(409, 'That is not possible for this job right now.')
  }
}

function pickDate(job, value) {
  if (typeof value !== 'string' || !DATE.test(value)) throw new Refusal(400, 'Please choose a valid date.')
  if (!job.window_start || !job.window_end || value < job.window_start || value > job.window_end) {
    throw new Refusal(400, 'That date is outside the available window.')
  }
  return value
}

function cleanText(value, max) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

// ---------- reading ----------

async function loadJob(token) {
  const { data, error } = await getDb()
    .from('cleaning_job')
    .select('*, stay(check_in, check_out), cleaner(name)')
    .eq('job_token', token)
    .maybeSingle()
  if (error) throw error
  // Same message for "no such link" and "expired" so nothing is revealed.
  if (!data || (data.expires_at && new Date(data.expires_at) < new Date())) {
    throw new Refusal(410, 'This link is no longer active.')
  }
  return data
}

// What the browser is allowed to see. Anything not listed here is never sent.
async function buildPayload(job) {
  const db = getDb()
  let supplies = []
  let flags = []

  // Supply data is only needed while the job is active.
  if (ACTIVE.includes(job.status)) {
    const [s, f] = await Promise.all([
      db.from('supply_item')
        .select('id, name, category, par_level_note')
        .eq('property_id', job.property_id)
        .or('archived.is.null,archived.eq.false')
        .order('category', { ascending: true }),
      db.from('supply_flag')
        .select('supply_item_id, status, cleaner_note')
        .eq('job_id', job.id)
        .eq('resolved', false),
    ])
    if (s.error) throw s.error
    if (f.error) throw f.error
    supplies = s.data || []
    flags = f.data || []
  }

  return {
    job: {
      status: job.status,
      scheduled_date: job.scheduled_date,
      window_start: job.window_start,
      window_end: job.window_end,
      agreed_rate: job.agreed_rate,
      payment_status: job.payment_status,
      cleaner_notes: job.cleaner_notes,
      job_token: job.job_token,
      title: job.title,
      worker_name: job.worker_name,
      stay: job.stay ? { check_in: job.stay.check_in, check_out: job.stay.check_out } : null,
      cleaner: job.cleaner ? { name: job.cleaner.name } : null,
    },
    supplies,
    flags,
  }
}

// ---------- writing ----------

async function updateJob(job, patch) {
  const { error } = await getDb().from('cleaning_job').update(patch).eq('id', job.id)
  if (error) throw error
}

const actions = {
  async get() { },

  async accept(job, body) {
    need(job, ['offered'])
    await updateJob(job, { status: 'confirmed', scheduled_date: pickDate(job, body.date) })
  },

  async decline(job) {
    need(job, ['offered'])
    await updateJob(job, { status: 'declined' })
  },

  async change_date(job, body) {
    need(job, ACTIVE)
    await updateJob(job, { scheduled_date: pickDate(job, body.date) })
  },

  async resign(job, body) {
    need(job, ACTIVE)
    const note = cleanText(body.note, 500)
    await updateJob(job, {
      status: 'declined',
      payment_note: note ? `Resigned: ${note}` : 'Resigned by cleaner',
    })
  },

  async save_notes(job, body) {
    need(job, ACTIVE)
    await updateJob(job, { cleaner_notes: cleanText(body.notes, 4000) })
  },

  async complete(job) {
    need(job, ACTIVE)
    await updateJob(job, { status: 'complete' })
  },

  async undo_complete(job) {
    need(job, ['complete'])
    if (job.payment_status === 'paid') {
      throw new Refusal(409, 'This job has already been paid, so it cannot be reopened.')
    }
    await updateJob(job, { status: 'confirmed' })
  },

  async submit_flags(job, body) {
    need(job, ACTIVE)
    const db = getDb()
    const flags = body.flags && typeof body.flags === 'object' ? body.flags : {}
    const notes = body.notes && typeof body.notes === 'object' ? body.notes : {}
    const ids = Object.keys(flags)

    if (ids.length === 0 || ids.length > 300) throw new Refusal(400, 'Nothing to submit.')
    if (!ids.every(id => UUID.test(id) && LEVELS.includes(flags[id]))) {
      throw new Refusal(400, 'Invalid supply report.')
    }

    // Only accept items that really belong to THIS job's property.
    const { data: valid, error: vErr } = await db
      .from('supply_item').select('id').eq('property_id', job.property_id).in('id', ids)
    if (vErr) throw vErr
    const validIds = new Set((valid || []).map(r => r.id))

    for (const id of ids) {
      if (!validIds.has(id)) continue
      const status = flags[id]
      const note = cleanText(notes[id], 500) || null

      const { data: existing, error: eErr } = await db
        .from('supply_flag').select('id').eq('job_id', job.id).eq('supply_item_id', id).maybeSingle()
      if (eErr) throw eErr

      if (status === 'ok') {
        if (existing) {
          const { error } = await db.from('supply_flag')
            .update({ resolved: true, cleaner_note: null }).eq('id', existing.id)
          if (error) throw error
        }
      } else if (existing) {
        const { error } = await db.from('supply_flag')
          .update({ status, cleaner_note: note, resolved: false }).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await db.from('supply_flag')
          .insert([{ job_id: job.id, supply_item_id: id, status, cleaner_note: note }])
        if (error) throw error
      }

      const { error: iErr } = await db.from('supply_item').update({ current_status: status }).eq('id', id)
      if (iErr) throw iErr
    }
  },

  async add_supply(job, body) {
    need(job, ACTIVE)
    const db = getDb()
    const name = cleanText(body.name, 100)
    const category = cleanText(body.category, 50) || null
    const status = LEVELS.includes(body.status) ? body.status : 'low'
    if (!name) throw new Refusal(400, 'Please enter an item name.')

    // Safety valve so a leaked link cannot flood the supply list.
    const { count, error: cErr } = await db
      .from('supply_item').select('id', { count: 'exact', head: true }).eq('property_id', job.property_id)
    if (cErr) throw cErr
    if (count >= 200) throw new Refusal(409, 'The supply list is full. Please tell the owner.')

    const { data: item, error } = await db
      .from('supply_item')
      .insert([{ property_id: job.property_id, name, category, current_status: status }])
      .select('id')
      .single()
    if (error) throw error

    if (status !== 'ok') {
      const { error: fErr } = await db
        .from('supply_flag').insert([{ job_id: job.id, supply_item_id: item.id, status }])
      if (fErr) throw fErr
    }
  },
}

// ---------- the entry point Netlify calls ----------

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' })

  try {
    let body
    try {
      body = await req.json()
    } catch {
      return json(400, { error: 'Bad request.' })
    }

    const { token, action } = body || {}
    if (typeof token !== 'string' || !UUID.test(token) || typeof action !== 'string' || !(action in actions)) {
      return json(400, { error: 'Bad request.' })
    }

    const job = await loadJob(token)
    await actions[action](job, body)

    // Re-read so the browser always gets the true, fresh state.
    const fresh = action === 'get' ? job : await loadJob(token)
    return json(200, await buildPayload(fresh))
  } catch (err) {
    if (err instanceof Refusal) return json(err.status, { error: err.message })
    console.error('job function error:', err)
    return json(500, { error: 'Something went wrong. Please try again.' })
  }
}
