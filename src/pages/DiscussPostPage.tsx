import { useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Camera, CheckCircle2, CornerDownRight, ExternalLink, LogIn, MessageCircle, Share2, Trash2 } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import {
  addForumComment,
  deleteForumComment,
  deleteForumPost,
  deletePhoto,
  getForumPost,
  listForumComments,
  listPhotos,
  setForumPostClosed,
  uploadPhotos,
} from '../lib/api'
import { categoryInfo, friendlyError, timeAgo } from '../lib/format'
import { TEAMUP_CATEGORIES, type ForumComment } from '../lib/types'
import Breadcrumbs from '../components/Breadcrumbs'
import { useLoader } from '../lib/useLoader'
import { usePageMeta } from '../lib/usePageMeta'
import { AnonymousToggle, AuthorTag, CostBadge, PlaceBadge, TeamUpInfo, VoteButtons } from '../components/forum'
import { PhotoGallery, PhotoPicker } from '../components/photos'
import { EmptyState, ErrorBox, Spinner, buttonPrimary, card, inputClass } from '../components/ui'

type Node = ForumComment & { children: Node[] }

export default function DiscussPostPage() {
  const { id = '' } = useParams()
  const { isAdmin, session } = useAuth()
  const navigate = useNavigate()
  const { data, setData, loading, error, reload } = useLoader(async () => {
    const [post, comments, photos] = await Promise.all([
      getForumPost(id),
      listForumComments(id),
      listPhotos('forum_post_id', [id]).catch(() => []),
    ])
    return { post, comments, photos }
  }, [id])
  usePageMeta(data?.post?.title, data?.post?.body)
  const location = useLocation()
  const [actionError, setActionError] = useState(
    (location.state as { photoProblem?: string } | null)?.photoProblem
      ? `Your post is up, but the photos didn't upload: ${(location.state as { photoProblem: string }).photoProblem}`
      : '',
  )
  const [adding, setAdding] = useState<File[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState(false)

  const tree = useMemo(() => {
    const byId = new Map<string, Node>()
    for (const c of data?.comments ?? []) byId.set(c.id, { ...c, children: [] })
    const roots: Node[] = []
    for (const node of byId.values()) {
      const parent = node.parent_id ? byId.get(node.parent_id) : null
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
    return roots
  }, [data?.comments])

  if (loading) return <Spinner />
  if (error) return <ErrorBox>{error}</ErrorBox>
  const post = data?.post
  if (!post) {
    return (
      <EmptyState title="This post isn't available">
        It was removed, or it's in a members-only section.{' '}
        <Link to="/discuss" className="font-semibold text-primary">Back to discussions</Link>
      </EmptyState>
    )
  }

  const cat = categoryInfo(post.category)
  const teamUp = TEAMUP_CATEGORIES.includes(post.category)

  async function toggleClosed() {
    try {
      await setForumPostClosed(post!.id, !post!.is_closed)
      setData({ ...data!, post: { ...post!, is_closed: !post!.is_closed } })
    } catch (err) {
      setActionError(friendlyError(err))
    }
  }

  async function removePost() {
    if (!window.confirm('Delete this post and all its comments?')) return
    try {
      await deleteForumPost(post!.id, !post!.is_mine && isAdmin)
      navigate('/discuss', { replace: true })
    } catch (err) {
      setActionError(friendlyError(err))
    }
  }

  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: post!.title, url })
      else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Breadcrumbs items={[['Discussions', '/discuss'], [cat.label, `/discuss?c=${post.category}`], [post.title]]} />

      <article className={`${card} p-5 sm:p-7`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <Link to={`/discuss?c=${post.category}`} className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 hover:bg-slate-200">
            {cat.emoji} {cat.label}
          </Link>
          <AuthorTag username={post.author_username} anonymous={post.is_anonymous} isMine={post.is_mine} />
          <span>· {timeAgo(post.created_at)}</span>
        </div>
        <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">{post.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <PlaceBadge post={post} />
          <CostBadge cost={post.cost_note} />
        </div>
        {teamUp && (
          <div className="mt-4 space-y-2">
            <TeamUpInfo post={post} />
            <div className="flex flex-wrap gap-2">
              {post.link_url && (
                <a href={post.link_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                  Event page <ExternalLink size={14} />
                </a>
              )}
              {post.is_mine && (
                <button onClick={() => void toggleClosed()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                  <CheckCircle2 size={15} /> {post.is_closed ? 'Reopen team' : 'Mark team as full'}
                </button>
              )}
            </div>
          </div>
        )}
        {post.body && <p className="mt-4 whitespace-pre-line leading-7 text-slate-700">{post.body}</p>}

        {data!.photos.length > 0 && (
          <div className="mt-5">
            <PhotoGallery
              photos={data!.photos}
              userId={session?.user.id}
              canManage={isAdmin}
              size="lg"
              onDelete={async (p) => {
                await deletePhoto(p)
                await reload()
              }}
            />
          </div>
        )}

        {post.is_mine && (
          <div className="mt-4">
            {adding === null ? (
              <button onClick={() => setAdding([])} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-primary">
                <Camera size={15} /> Add photos
              </button>
            ) : (
              <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                <PhotoPicker files={adding} onChange={setAdding} max={Math.max(0, 6 - data!.photos.filter((p) => p.status !== 'rejected').length)} />
                <div className="flex gap-2">
                  <button
                    disabled={uploading || adding.length === 0}
                    onClick={async () => {
                      setUploading(true)
                      try {
                        await uploadPhotos({ forum_post_id: post.id }, adding, session!.user.id)
                        setAdding(null)
                        await reload()
                      } catch (err) {
                        setActionError(friendlyError(err))
                      } finally {
                        setUploading(false)
                      }
                    }}
                    className={`${buttonPrimary} px-4 py-2`}
                  >
                    {uploading ? 'Uploading…' : 'Upload for review'}
                  </button>
                  <button onClick={() => setAdding(null)} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <VoteButtons post={post} layout="horizontal" signedIn={Boolean(session)} />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
            <MessageCircle size={15} /> {data!.comments.length}
          </span>
          <button onClick={() => void share()} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-200">
            <Share2 size={15} /> {copied ? 'Link copied!' : 'Share'}
          </button>
          {(post.is_mine || isAdmin) && (
            <button onClick={() => void removePost()} className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600">
              <Trash2 size={15} /> {post.is_mine ? 'Delete' : 'Remove (admin)'}
            </button>
          )}
        </div>
      </article>

      <ErrorBox>{actionError}</ErrorBox>

      <section className={`${card} p-5 sm:p-6`}>
        {session ? (
          <CommentForm
            postId={post.id}
            onPosted={reload}
            defaultAnonymous={post.is_anonymous && post.is_mine}
            placeholder={teamUp && !post.is_mine ? 'Interested? Say what you can bring…' : undefined}
          />
        ) : (
          <Link
            to={`/login?next=${encodeURIComponent(`/discuss/${post.id}`)}`}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary"
          >
            <LogIn size={16} /> Sign in with your email to comment
          </Link>
        )}

        <div className="mt-6">
          {tree.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No comments yet. Start the conversation!</p>
          ) : (
            <ul className="space-y-5">
              {tree.map((node) => (
                <CommentItem key={node.id} node={node} postId={post.id} isAdmin={isAdmin} onChange={reload} depth={0} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

function CommentForm({
  postId,
  parentId = null,
  onPosted,
  onCancel,
  defaultAnonymous = false,
  autoFocus = false,
  placeholder,
}: {
  placeholder?: string
  postId: string
  parentId?: string | null
  onPosted: () => Promise<void>
  onCancel?: () => void
  defaultAnonymous?: boolean
  autoFocus?: boolean
}) {
  const { profile } = useAuth()
  const [body, setBody] = useState('')
  const [anonymous, setAnonymous] = useState(defaultAnonymous)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    setError('')
    try {
      await addForumComment(postId, body.trim(), anonymous, parentId)
      setBody('')
      onCancel?.()
      await onPosted()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        rows={parentId ? 2 : 3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={4000}
        autoFocus={autoFocus}
        placeholder={placeholder ?? (parentId ? 'Write a reply…' : 'Add a comment…')}
        className={`${inputClass} mt-0`}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AnonymousToggle value={anonymous} onChange={setAnonymous} username={profile?.username ?? null} />
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
              Cancel
            </button>
          )}
          <button type="submit" disabled={busy || !body.trim()} className={`${buttonPrimary} px-4 py-2`}>
            {busy ? 'Posting…' : parentId ? 'Reply' : 'Comment'}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}

function CommentItem({
  node,
  postId,
  isAdmin,
  onChange,
  depth,
}: {
  node: Node
  postId: string
  isAdmin: boolean
  onChange: () => Promise<void>
  depth: number
}) {
  const { session } = useAuth()
  const [replying, setReplying] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  async function remove() {
    if (!window.confirm('Delete this comment and its replies?')) return
    await deleteForumComment(node.id, !node.is_mine && isAdmin)
    await onChange()
  }

  return (
    <li>
      <div className="flex gap-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand thread' : 'Collapse thread'}
          className="flex w-7 shrink-0 flex-col items-center"
        >
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${node.is_anonymous ? 'bg-ink text-on-ink' : 'bg-red-50 text-primary'}`}>
            {node.is_anonymous ? '?' : (node.author_username ?? '?').charAt(0).toUpperCase()}
          </span>
          {!collapsed && node.children.length > 0 && <span className="mt-1 w-px flex-1 bg-slate-200 hover:bg-primary" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <AuthorTag username={node.author_username} anonymous={node.is_anonymous} isOp={node.is_op} isMine={node.is_mine} />
            <span>· {timeAgo(node.created_at)}</span>
            {collapsed && node.children.length > 0 && <span className="font-semibold text-primary">+{node.children.length} replies</span>}
          </div>
          {!collapsed && (
            <>
              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-800">{node.body}</p>
              <div className="mt-1 flex gap-3 text-xs font-semibold text-slate-500">
                {depth < 4 && session && (
                  <button onClick={() => setReplying(!replying)} className="inline-flex items-center gap-1 hover:text-primary">
                    <CornerDownRight size={13} /> Reply
                  </button>
                )}
                {(node.is_mine || isAdmin) && (
                  <button onClick={() => void remove()} className="hover:text-red-600">
                    {node.is_mine ? 'Delete' : 'Remove'}
                  </button>
                )}
              </div>
              {replying && (
                <div className="mt-2">
                  <CommentForm postId={postId} parentId={node.id} onPosted={onChange} onCancel={() => setReplying(false)} autoFocus />
                </div>
              )}
              {node.children.length > 0 && (
                <ul className="mt-4 space-y-4">
                  {node.children.map((child) => (
                    <CommentItem key={child.id} node={child} postId={postId} isAdmin={isAdmin} onChange={onChange} depth={depth + 1} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  )
}
