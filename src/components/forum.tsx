import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowBigDown, ArrowBigUp, CalendarClock, EyeOff, MapPin, Users, Wallet } from 'lucide-react'

import { deadlineLabel, mapLinks } from '../lib/format'

import { voteForumPost } from '../lib/api'
import type { ForumPost } from '../lib/types'

/** Up / down arrows with the score. Optimistic: updates instantly. */
export function VoteButtons({
  post,
  onVoted,
  layout = 'vertical',
  signedIn = true,
}: {
  post: Pick<ForumPost, 'id' | 'score' | 'my_vote'>
  onVoted?: (score: number, myVote: -1 | 1 | null) => void
  layout?: 'vertical' | 'horizontal'
  /** Signed-out readers are sent to sign in when they try to vote. */
  signedIn?: boolean
}) {
  const [state, setState] = useState({ score: post.score, mine: post.my_vote })
  const navigate = useNavigate()
  const location = useLocation()

  async function vote(e: React.MouseEvent, dir: -1 | 1) {
    e.preventDefault()
    e.stopPropagation()
    if (!signedIn) {
      navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
      return
    }
    const next = state.mine === dir ? null : dir
    const optimistic = state.score - (state.mine ?? 0) + (next ?? 0)
    const before = state
    setState({ score: optimistic, mine: next })
    try {
      const score = await voteForumPost(post.id, next ?? 0)
      setState({ score, mine: next })
      onVoted?.(score, next)
    } catch {
      setState(before)
    }
  }

  return (
    <div className={`flex items-center ${layout === 'vertical' ? 'flex-col' : 'gap-1 rounded-full bg-slate-100 px-1'}`}>
      <button
        onClick={(e) => void vote(e, 1)}
        aria-label="Upvote"
        aria-pressed={state.mine === 1}
        className={`rounded-md p-1 transition hover:bg-red-50 ${state.mine === 1 ? 'text-primary' : 'text-slate-400 hover:text-primary'}`}
      >
        <ArrowBigUp size={22} fill={state.mine === 1 ? 'currentColor' : 'none'} />
      </button>
      <span className={`min-w-[1.5rem] text-center text-sm font-bold ${state.mine === 1 ? 'text-primary' : state.mine === -1 ? 'text-indigo-600' : 'text-slate-700'}`}>
        {state.score}
      </span>
      <button
        onClick={(e) => void vote(e, -1)}
        aria-label="Downvote"
        aria-pressed={state.mine === -1}
        className={`rounded-md p-1 transition hover:bg-indigo-50 ${state.mine === -1 ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`}
      >
        <ArrowBigDown size={22} fill={state.mine === -1 ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}

export function AuthorTag({ username, anonymous, isOp, isMine }: { username: string | null; anonymous: boolean; isOp?: boolean; isMine?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      {anonymous ? (
        <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
          <EyeOff size={12} /> Anonymous
        </span>
      ) : (
        <span className="font-semibold text-slate-700">@{username ?? 'deleted'}</span>
      )}
      {isOp && <span className="rounded bg-red-50 px-1 text-[10px] font-bold text-primary">OP</span>}
      {isMine && <span className="text-slate-400">(you)</span>}
    </span>
  )
}

export function PlaceBadge({ post }: { post: Pick<ForumPost, 'place_name' | 'place_area' | 'map_url'> }) {
  if (!post.place_name && !post.place_area) return null
  const text = [post.place_name, post.place_area].filter(Boolean).join(' · ')
  const inner = (
    <>
      <MapPin size={14} className="shrink-0" />
      <span className="truncate">{text}</span>
    </>
  )
  // No map link given? Search for the place in Naver Map instead.
  const href = post.map_url || mapLinks(text).naver
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
    >
      {inner} <span className="text-emerald-500">↗</span>
    </a>
  ) : (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{inner}</span>
  )
}

/** "Post as @username" / "Post anonymously" switch, with a live preview. */
export function AnonymousToggle({
  value,
  onChange,
  username,
}: {
  value: boolean
  onChange: (v: boolean) => void
  username: string | null
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-500">Post as</span>
      <div className="inline-flex rounded-full bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`rounded-full px-3 py-1 font-semibold transition ${!value ? 'bg-surface text-slate-900 shadow' : 'text-slate-500'}`}
        >
          @{username ?? 'you'}
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold transition ${value ? 'bg-ink text-on-ink shadow' : 'text-slate-500'}`}
        >
          <EyeOff size={13} /> Anonymous
        </button>
      </div>
    </div>
  )
}

export function CostBadge({ cost }: { cost: string | null }) {
  if (!cost) return null
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
      <Wallet size={13} /> {cost}
    </span>
  )
}

/** Team up summary: roles wanted, deadline, open/full. */
export function TeamUpInfo({ post, compact = false }: { post: Pick<ForumPost, 'looking_for' | 'deadline' | 'is_closed'>; compact?: boolean }) {
  const due = deadlineLabel(post.deadline)
  const roles = (post.looking_for ?? '').split(/[,;\n]/).map((r) => r.trim()).filter(Boolean)
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'rounded-xl bg-indigo-50/60 p-3'}`}>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
          post.is_closed || due?.past ? 'bg-slate-200 text-slate-600' : 'bg-green-100 text-green-800'
        }`}
      >
        {post.is_closed ? 'Team full' : due?.past ? 'Closed' : 'Open'}
      </span>
      {roles.length > 0 && (
        <span className="inline-flex flex-wrap items-center gap-1 text-xs text-indigo-900">
          <Users size={13} className="text-indigo-500" />
          {roles.map((r) => (
            <span key={r} className="rounded-full bg-surface px-2 py-0.5 font-semibold ring-1 ring-indigo-200">
              {r}
            </span>
          ))}
        </span>
      )}
      {due && !post.is_closed && (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${due.urgent ? 'text-red-600' : 'text-slate-600'}`}>
          <CalendarClock size={13} /> {due.text}
        </span>
      )}
    </div>
  )
}
