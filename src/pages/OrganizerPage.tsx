import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'

import { listEvents, listRsvpCounts } from '../lib/api'
import { formatDate, isPast } from '../lib/format'
import type { HubEvent } from '../lib/types'
import { useLoader } from '../lib/useLoader'
import EventForm from '../components/organizer/EventForm'
import EventManagePanel from '../components/organizer/EventManagePanel'
import { ErrorBox, PageHeader, Spinner, buttonPrimary, card } from '../components/ui'

export default function OrganizerPage() {
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('event')
  const mode = params.get('new') === '1' ? 'new' : params.get('edit') === '1' ? 'edit' : 'view'

  const { data, loading, error, reload } = useLoader(async () => {
    const [events, counts] = await Promise.all([listEvents(), listRsvpCounts()])
    return { events, counts }
  }, [])

  const events = data?.events ?? []
  const selected = events.find((e) => e.id === selectedId)
  const upcoming = events.filter((e) => !isPast(e))
  const past = events.filter((e) => isPast(e)).reverse()

  function go(next: Record<string, string>) {
    setParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSaved(event: HubEvent) {
    await reload()
    go({ event: event.id })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organizer"
        title="Manage events"
        description="Create an event, share one link, and watch RSVPs come in. Export the list when you need it."
        action={
          <button onClick={() => go({ new: '1' })} className={buttonPrimary}>
            <Plus size={16} />
            New event
          </button>
        }
      />

      <ErrorBox>{error}</ErrorBox>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className={`${card} h-fit p-3 ${mode !== 'view' || selected ? 'hidden lg:block' : ''}`}>
          {loading ? (
            <Spinner />
          ) : events.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No events yet. Create the first one!</p>
          ) : (
            <>
              <EventGroup
                title="Upcoming"
                events={upcoming}
                selectedId={selectedId}
                counts={data?.counts}
                onSelect={(id) => go({ event: id })}
              />
              {past.length > 0 && (
                <EventGroup
                  title="Past"
                  events={past}
                  selectedId={selectedId}
                  counts={data?.counts}
                  onSelect={(id) => go({ event: id })}
                />
              )}
            </>
          )}
        </aside>

        <div className="min-w-0">
          {mode === 'new' ? (
            <EventForm onSaved={handleSaved} onCancel={() => go({})} />
          ) : mode === 'edit' && selected ? (
            <EventForm
              key={selected.id}
              event={selected}
              onSaved={handleSaved}
              onCancel={() => go({ event: selected.id })}
            />
          ) : selected ? (
            <>
              <button
                onClick={() => go({})}
                className="mb-3 text-sm font-semibold text-slate-500 hover:text-primary lg:hidden"
              >
                ← All my events
              </button>
              <EventManagePanel
                key={selected.id}
                event={selected}
                onEdit={() => go({ event: selected.id, edit: '1' })}
                onChanged={() => void reload()}
                onDeleted={async () => {
                  await reload()
                  go({})
                }}
              />
            </>
          ) : (
            !loading && (
              <div className="hidden rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 lg:block">
                Pick an event on the left to see responses, or create a new one.
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function EventGroup({
  title,
  events,
  selectedId,
  counts,
  onSelect,
}: {
  title: string
  events: HubEvent[]
  selectedId: string | null
  counts?: Record<string, { attending: number }>
  onSelect: (id: string) => void
}) {
  return (
    <div className="mb-2">
      <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      {events.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">None</p>}
      {events.map((event) => (
        <button
          key={event.id}
          onClick={() => onSelect(event.id)}
          className={`block w-full rounded-xl px-3 py-2.5 text-left ${
            event.id === selectedId ? 'bg-red-50' : 'hover:bg-slate-50'
          }`}
        >
          <p className={`text-sm font-semibold ${event.id === selectedId ? 'text-primary' : ''}`}>
            {event.title}
          </p>
          <p className="text-xs text-slate-500">
            {formatDate(event.event_date)} · {counts?.[event.id]?.attending ?? 0} going
          </p>
        </button>
      ))}
    </div>
  )
}
