import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle2,
  CloudUpload,
  ExternalLink,
  GitBranch,
  Home,
  Image,
  ListChecks,
  Loader2,
  Lock,
  PawPrint,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Star,
  Trash2,
  Undo2,
  Unlock,
} from 'lucide-react'
import {
  addActionVideo,
  createPetFromWebm,
  createRoomFromMedia,
  discardDraft,
  getAdminState,
  getPetManifest,
  inspectPetWebm,
  publishConfig,
  rollbackToVersion,
  saveDraft,
} from './api'
import {
  cloneConfig,
  diffConfigs,
  generateDiffSummary,
  nextSortOrder,
  normalizeBootstrapConfig,
  removePet,
  removeRoom,
  setDefaultPet,
  setDefaultRoom,
  togglePetEnabled,
  toggleRoomEnabled,
  upsertPet,
  upsertRoom,
  validateConfig,
} from './configTools'
import {
  AdminAuditLog,
  AdminState,
  BootstrapConfig,
  MediaCreateResult,
  MediaInspectResult,
  PetManifestSummary,
  PetOption,
  RoomMediaCreateResult,
  RoomOption,
  ValidationIssue,
  VersionRecord,
} from './types'

type RouteKey = 'dashboard' | 'pets' | 'rooms' | 'home' | 'media' | 'publish'

const navItems: Array<{ key: RouteKey; path: string; label: string; icon: typeof Home }> = [
  { key: 'dashboard', path: '/dashboard', label: '概览', icon: Home },
  { key: 'pets', path: '/pets', label: '宠物', icon: PawPrint },
  { key: 'rooms', path: '/rooms', label: '背景', icon: Image },
  { key: 'home', path: '/home', label: '首页配置', icon: ListChecks },
  { key: 'media', path: '/media', label: '素材自动化', icon: CloudUpload },
  { key: 'publish', path: '/publish', label: '发布中心', icon: GitBranch },
]

function emptyPet(sortOrder: number): PetOption {
  return {
    id: '',
    name: '',
    subtitle: '',
    frameOffset: sortOrder,
    manifestKey: '',
    videoUrl: '',
    thumbUrl: '',
    listenFrameUrl: '',
    enabled: true,
  }
}

function emptyRoom(): RoomOption {
  return {
    id: '',
    name: '',
    subtitle: '',
    kind: 'image',
    mediaUrl: '',
    thumbUrl: '',
    enabled: true,
  }
}

export function App() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const stateQuery = useQuery<AdminState>({
    queryKey: ['admin-state'],
    queryFn: getAdminState,
  })

  const applyState = (next: AdminState) => {
    queryClient.setQueryData(['admin-state'], next)
  }

  const saveMutation = useMutation({
    mutationFn: saveDraft,
    onSuccess: applyState,
  })
  const discardMutation = useMutation({
    mutationFn: discardDraft,
    onSuccess: applyState,
  })
  const publishMutation = useMutation({
    mutationFn: publishConfig,
    onSuccess: applyState,
  })
  const rollbackMutation = useMutation({
    mutationFn: rollbackToVersion,
    onSuccess: applyState,
  })

  const state = stateQuery.data
  const published = useMemo(
    () => (state?.published ? normalizeBootstrapConfig(state.published) : undefined),
    [state?.published],
  )
  const draft = useMemo(
    () => (state?.draft ? normalizeBootstrapConfig(state.draft) : undefined),
    [state?.draft],
  )
  const workingConfig = draft || published
  const issues = useMemo(
    () => (workingConfig ? validateConfig(workingConfig, { strict: true }) : []),
    [workingConfig],
  )

  const title = navItems.find((item) => location.pathname.startsWith(item.path))?.label || '概览'

  function updateConfig(next: BootstrapConfig) {
    saveMutation.mutate(next)
  }

  const mutationError =
    saveMutation.error || discardMutation.error || publishMutation.error || rollbackMutation.error
  const saving = saveMutation.isPending || discardMutation.isPending

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">宠</div>
          <div>
            <div className="brand-title">宠物小小镇</div>
            <div className="brand-subtitle">后台管理</div>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon
            const showBadge = item.key === 'publish' && state?.hasDraftChanges
            return (
              <NavLink className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} key={item.key} to={item.path}>
                <Icon size={18} />
                <span>{item.label}</span>
                {showBadge && <span className="nav-badge">未发布</span>}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            <p>
              {state?.meta?.envId
                ? `环境：${state.meta.envId}`
                : '当前管理线上启动配置、宠物和背景素材。'}
            </p>
          </div>
          <div className="topbar-actions">
            <DraftBadge state={state} saving={saving} />
            <button className="icon-button" onClick={() => stateQuery.refetch()} title="刷新配置" type="button">
              <RefreshCw size={18} />
            </button>
          </div>
        </header>

        {stateQuery.isLoading && (
          <div className="empty-state">
            <Loader2 className="spin" size={24} />
            <span>正在读取配置</span>
          </div>
        )}

        {stateQuery.error && (
          <div className="error-state">
            {stateQuery.error instanceof Error ? stateQuery.error.message : '配置读取失败'}
          </div>
        )}

        {mutationError && (
          <div className="error-state">
            {mutationError instanceof Error ? mutationError.message : '操作失败'}
          </div>
        )}

        {workingConfig && state && published && (
          <Routes>
            <Route path="/" element={<Navigate replace to="/dashboard" />} />
            <Route
              path="/dashboard"
              element={
                <Dashboard
                  auditLogs={state.auditLogs || []}
                  config={workingConfig}
                  hasDraftChanges={state.hasDraftChanges}
                  hasDraft={state.hasDraft}
                  issues={issues}
                  versions={state.versions}
                />
              }
            />
            <Route
              path="/pets"
              element={
                <PetsView
                  config={workingConfig}
                  onChange={updateConfig}
                  saving={saving}
                />
              }
            />
            <Route
              path="/pets/:petId"
              element={
                <PetManagePage
                  config={workingConfig}
                  onChange={updateConfig}
                  saving={saving}
                />
              }
            />
            <Route
              path="/rooms"
              element={
                <RoomsView
                  config={workingConfig}
                  onChange={updateConfig}
                  saving={saving}
                />
              }
            />
            <Route
              path="/home"
              element={
                <HomeView
                  config={workingConfig}
                  onChange={updateConfig}
                  saving={saving}
                />
              }
            />
            <Route
              path="/media"
              element={
                <MediaView onState={applyState} />
              }
            />
            <Route
              path="/publish"
              element={
                <PublishView
                  state={state}
                  draft={draft}
                  published={published}
                  issues={issues}
                  onPublish={(summary) => publishMutation.mutate(summary)}
                  onDiscard={() => discardMutation.mutate()}
                  onRollback={(versionId) => rollbackMutation.mutate(versionId)}
                  publishing={publishMutation.isPending}
                  discarding={discardMutation.isPending}
                  rolling={rollbackMutation.isPending}
                />
              }
            />
            <Route path="*" element={<Navigate replace to="/dashboard" />} />
          </Routes>
        )}
      </main>
    </div>
  )
}

function DraftBadge({ state, saving }: { state: AdminState | undefined; saving: boolean }) {
  if (!state) return null

  if (saving) {
    return (
      <span className="draft-badge saving">
        <Loader2 className="spin" size={14} />
        保存中
      </span>
    )
  }

  if (state.hasDraftChanges) {
    return <span className="draft-badge dirty">草稿有未发布改动</span>
  }

  if (state.hasDraft) {
    return <span className="draft-badge ok">草稿与线上一致</span>
  }

  return <span className="draft-badge ok">无草稿</span>
}

function Dashboard({
  auditLogs,
  config,
  hasDraftChanges,
  hasDraft,
  issues,
  versions,
}: {
  auditLogs: AdminAuditLog[]
  config: BootstrapConfig
  hasDraftChanges: boolean
  hasDraft: boolean
  issues: ValidationIssue[]
  versions: VersionRecord[]
}) {
  const enabledPets = config.pets.filter((pet) => pet.enabled !== false)
  const enabledRooms = config.rooms.filter((room) => room.enabled !== false)
  const draftStatus = hasDraftChanges ? '有未发布改动' : hasDraft ? '草稿与线上一致' : '无草稿'
  const draftTone: 'ok' | 'warn' = hasDraftChanges ? 'warn' : 'ok'

  return (
    <section className="grid metrics-grid">
      <Metric title="启用宠物" value={`${enabledPets.length}/${config.pets.length}`} />
      <Metric title="启用背景" value={`${enabledRooms.length}/${config.rooms.length}`} />
      <Metric title="草稿状态" value={draftStatus} tone={draftTone} />
      <Metric title="校验问题" value={`${issues.length}`} tone={issues.length ? 'warn' : 'ok'} />
      <div className="panel span-2">
        <h2>当前默认</h2>
        <div className="summary-list">
          <span>默认宠物：{config.pets.find((pet) => pet.id === config.defaultPetId)?.name || config.defaultPetId || '-'}</span>
          <span>默认背景：{config.rooms.find((room) => room.id === config.defaultRoomId)?.name || config.defaultRoomId || '-'}</span>
          <span>首页提示：{config.homeHint}</span>
          <span>配置版本：{config.configVersion}</span>
        </div>
      </div>
      <div className="panel span-2">
        <h2>配置校验</h2>
        {issues.length === 0 ? (
          <div className="result-box ok">
            <CheckCircle2 size={18} />
            当前配置可用
          </div>
        ) : (
          <div className="issue-list">
            {issues.map((issue) => (
              <div key={`${issue.field}-${issue.message}`}>{issue.message}</div>
            ))}
          </div>
        )}
      </div>
      <div className="panel span-2">
        <h2>最近发布</h2>
        {versions.length === 0 ? (
          <span className="muted">还没有发布过配置</span>
        ) : (
          <div className="audit-list">
            {versions.slice(0, 5).map((version) => (
              <div className="audit-item" key={version.version}>
                <strong>{version.summary || version.version}</strong>
                <span>{version.version}</span>
                <small>{formatTime(version.publishedAt)} / {version.publishedBy || 'admin'}</small>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="panel span-2">
        <h2>最近操作</h2>
        <AuditList logs={auditLogs.slice(0, 5)} />
      </div>
    </section>
  )
}

function Metric({ title, value, tone }: { title: string; value: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className={`metric ${tone || ''}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  )
}

function PetsView({
  config,
  onChange,
  saving,
}: {
  config: BootstrapConfig
  onChange: (config: BootstrapConfig) => void
  saving: boolean
}) {
  const navigate = useNavigate()

  function togglePet(pet: PetOption) {
    onChange(togglePetEnabled(config, pet.id))
  }

  function setDefault(pet: PetOption) {
    onChange(setDefaultPet(config, pet.id))
  }

  function deletePet(pet: PetOption) {
    if (!window.confirm(`确认从配置中删除「${pet.name || pet.id}」？\n云存储里的素材不会删除，仅从启动配置移除。`)) return
    onChange(removePet(config, pet.id))
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>宠物列表</h2>
        <button className="primary-button" onClick={() => setEditing(emptyPet(nextSortOrder(config)))} type="button">
          新增宠物
        </button>
      </div>
      <DataTable
        columns={['状态', '预览', '名称', '副标题', 'ID', '排序', '默认', '操作']}
        rows={config.pets.map((pet) => [
          <StatusPill enabled={pet.enabled !== false} />,
          <PreviewImage alt={pet.name} src={pet.thumbUrl} />,
          pet.name,
          pet.subtitle,
          <CodeText value={pet.id} />,
          String(pet.frameOffset ?? 0),
          config.defaultPetId === pet.id ? <StarLabel /> : '否',
          <div className="row-actions">
            <button onClick={() => navigate(`/pets/${pet.id}`)} type="button">管理</button>
            <button
              disabled={config.defaultPetId === pet.id || pet.enabled === false}
              onClick={() => setDefault(pet)}
              title={pet.enabled === false ? '需要先启用才能设为默认' : ''}
              type="button"
            >
              设默认
            </button>
            <button onClick={() => togglePet(pet)} type="button">{pet.enabled === false ? '显示' : '隐藏'}</button>
            <button className="danger-button" onClick={() => deletePet(pet)} type="button" title="删除宠物">
              <Trash2 size={14} />
            </button>
          </div>,
        ])}
      />
    </section>
  )
}

function PetManagePage({
  config,
  onChange,
  saving,
}: {
  config: BootstrapConfig
  onChange: (config: BootstrapConfig) => void
  saving: boolean
}) {
  const { petId } = useParams<{ petId: string }>()
  const navigate = useNavigate()
  const pet = config.pets.find((p) => p.id === petId)
  const [draft, setDraft] = useState<PetOption | null>(null)
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set())
  const [manifest, setManifest] = useState<PetManifestSummary | null>(null)
  const [manifestLoading, setManifestLoading] = useState(false)
  const [manifestError, setManifestError] = useState('')

  useEffect(() => {
    if (pet) setDraft({ ...pet })
  }, [petId])

  useEffect(() => {
    if (!petId) return
    setManifestLoading(true)
    setManifestError('')
    getPetManifest(petId)
      .then(setManifest)
      .catch((err) => setManifestError(err.message || '加载失败'))
      .finally(() => setManifestLoading(false))
  }, [petId])

  if (!pet || !draft) {
    return (
      <section className="panel">
        <div className="error-state">未找到宠物 {petId}</div>
        <button className="secondary-button" onClick={() => navigate('/pets')} type="button">
          <ArrowLeft size={14} /> 返回列表
        </button>
      </section>
    )
  }

  function toggleLock(field: string) {
    setUnlocked((prev) => {
      const next = new Set(prev)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })
  }

  function handleSave() {
    if (!draft) return
    onChange(upsertPet(config, { ...draft, id: draft.id.trim(), manifestKey: draft.manifestKey || `${draft.id.trim()}/manifest.json` }))
  }

  const hasChanges = draft && pet && JSON.stringify(draft) !== JSON.stringify(pet)

  return (
    <section className="pet-manage-page">
      <div className="panel">
        <div className="panel-head">
          <button className="secondary-button" onClick={() => navigate('/pets')} type="button">
            <ArrowLeft size={14} /> 返回宠物列表
          </button>
          <h2>{pet.name}（{pet.id}）</h2>
        </div>

        <div className="manage-section">
          <h3>基本信息</h3>
          <div className="locked-fields">
            <LockedField label="ID" value={draft.id} disabled />
            <LockedField
              label="名称"
              value={draft.name}
              locked={!unlocked.has('name')}
              onToggle={() => toggleLock('name')}
              onChange={(v) => setDraft({ ...draft, name: v })}
            />
            <LockedField
              label="副标题"
              value={draft.subtitle}
              locked={!unlocked.has('subtitle')}
              onToggle={() => toggleLock('subtitle')}
              onChange={(v) => setDraft({ ...draft, subtitle: v })}
            />
            <LockedField
              label="排序"
              value={String(draft.frameOffset ?? 0)}
              locked={!unlocked.has('frameOffset')}
              onToggle={() => toggleLock('frameOffset')}
              onChange={(v) => setDraft({ ...draft, frameOffset: Number(v) || 0 })}
            />
            <LockedField
              label="manifestKey"
              value={draft.manifestKey || ''}
              locked={!unlocked.has('manifestKey')}
              onToggle={() => toggleLock('manifestKey')}
              onChange={(v) => setDraft({ ...draft, manifestKey: v })}
            />
            <LockedField
              label="视频 URL"
              value={draft.videoUrl || ''}
              locked={!unlocked.has('videoUrl')}
              onToggle={() => toggleLock('videoUrl')}
              onChange={(v) => setDraft({ ...draft, videoUrl: v })}
            />
            <LockedField
              label="预览图 URL"
              value={draft.thumbUrl || ''}
              locked={!unlocked.has('thumbUrl')}
              onToggle={() => toggleLock('thumbUrl')}
              onChange={(v) => setDraft({ ...draft, thumbUrl: v })}
            />
            <LockedField
              label="倾听图 URL"
              value={draft.listenFrameUrl || ''}
              locked={!unlocked.has('listenFrameUrl')}
              onToggle={() => toggleLock('listenFrameUrl')}
              onChange={(v) => setDraft({ ...draft, listenFrameUrl: v })}
            />
            <LockedField
              label="音频 URL"
              value={draft.audioUrl || ''}
              locked={!unlocked.has('audioUrl')}
              onToggle={() => toggleLock('audioUrl')}
              onChange={(v) => setDraft({ ...draft, audioUrl: v })}
            />
            <LockedCheckField
              label="启用"
              checked={draft.enabled !== false}
              locked={!unlocked.has('enabled')}
              onToggle={() => toggleLock('enabled')}
              onChange={(v) => setDraft({ ...draft, enabled: v })}
            />
          </div>
          <button
            className="primary-button"
            disabled={saving || !hasChanges}
            onClick={handleSave}
            type="button"
          >
            {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
            保存到草稿
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>场景视频</h3>
        </div>
        {manifestLoading && <div className="muted">加载中…</div>}
        {manifestError && <div className="error-state">{manifestError}</div>}
        {manifest && !manifest.actions.length && <div className="muted">该宠物还没有上传任何场景视频</div>}
        {manifest && manifest.actions.map((action) => (
          <div key={action.id} className="action-section">
            <div className="action-header">
              <h3>{action.label}（{action.id}）</h3>
              <span className="action-count">{action.videoUrls.length} 个视频</span>
              {action.audioUrl && <span className="action-audio-badge">有音频</span>}
              {!action.audioUrl && <span className="muted">无音频</span>}
            </div>
            {action.videoUrls.length === 0 && <span className="muted">暂无视频</span>}
            <div className="action-media-grid">
              {action.videoUrls.map((url, index) => (
                <MediaPreviewCard
                  key={url}
                  videoUrl={url}
                  audioUrl={action.audioUrl}
                  index={index}
                  canDelete={action.videoUrls.length > 1}
                  onDelete={() => {
                    if (!window.confirm(`确认删除第 ${index + 1} 个视频？关联音频也会一并删除。`)) return
                    import('./api').then((m) => m.deleteActionVideo(petId!, action.id, url)).then(() => {
                      getPetManifest(petId!).then(setManifest).catch(() => undefined)
                    }).catch((err) => window.alert(err.message || '删除失败'))
                  }}
                />
              ))}
              <ActionUploader petId={petId!} actionId={action.id} onUploaded={() => {
                getPetManifest(petId!).then(setManifest).catch(() => undefined)
              }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function LockedField({
  label,
  value,
  locked = true,
  disabled = false,
  onToggle,
  onChange,
}: {
  label: string
  value: string
  locked?: boolean
  disabled?: boolean
  onToggle?: () => void
  onChange?: (value: string) => void
}) {
  return (
    <div className={`locked-field ${!locked ? 'unlocked-field' : ''} ${disabled ? 'permanent-lock' : ''}`}>
      <span className="locked-field-label">{label}</span>
      {locked || disabled ? (
        <span className="locked-field-value">{value || '—'}</span>
      ) : (
        <input
          className="locked-field-input"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )}
      {!disabled && (
        <button className="lock-toggle" onClick={onToggle} type="button" title={locked ? '解锁编辑' : '锁定'}>
          {locked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>
      )}
      {disabled && <Lock size={14} className="lock-permanent" />}
    </div>
  )
}

function LockedCheckField({
  label,
  checked,
  locked = true,
  onToggle,
  onChange,
}: {
  label: string
  checked: boolean
  locked?: boolean
  onToggle?: () => void
  onChange?: (value: boolean) => void
}) {
  return (
    <div className={`locked-field ${!locked ? 'unlocked-field' : ''}`}>
      <span className="locked-field-label">{label}</span>
      {locked ? (
        <span className="locked-field-value">{checked ? '是' : '否'}</span>
      ) : (
        <input type="checkbox" checked={checked} onChange={(e) => onChange?.(e.target.checked)} />
      )}
      <button className="lock-toggle" onClick={onToggle} type="button" title={locked ? '解锁编辑' : '锁定'}>
        {locked ? <Lock size={14} /> : <Unlock size={14} />}
      </button>
    </div>
  )
}

function MediaPreviewCard({ videoUrl, audioUrl, index, canDelete, onDelete }: { videoUrl: string; audioUrl: string; index: number; canDelete?: boolean; onDelete?: () => void }) {
  const [videoSrc, setVideoSrc] = useState('')
  const [audioSrc, setAudioSrc] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  async function loadMedia() {
    if (expanded) {
      setExpanded(false)
      return
    }
    setLoading(true)
    try {
      const resolveUrl = async (url: string) => {
        if (!url) return ''
        if (!url.startsWith('cloud://')) return url
        const { url: resolved } = await import('./api').then((m) => m.resolveCloudUrl(url))
        return resolved
      }
      const [vSrc, aSrc] = await Promise.all([resolveUrl(videoUrl), resolveUrl(audioUrl)])
      setVideoSrc(vSrc)
      setAudioSrc(aSrc)
      setExpanded(true)
    } catch {
      window.alert('无法解析媒体地址')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="media-preview-card">
      <div className="media-preview-header">
        <div className="media-preview-info" onClick={loadMedia}>
          <Play size={16} />
          <span className="media-preview-seq">#{index + 1}</span>
          <span className="media-preview-name">{videoUrl.split('/').pop()}</span>
          {loading && <Loader2 size={14} className="spin" />}
        </div>
        <button
          className="media-delete-btn"
          disabled={!canDelete}
          onClick={onDelete}
          type="button"
          title={canDelete ? '删除此视频' : '该场景仅剩一个视频，不可删除'}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {expanded && (
        <div className="media-preview-player">
          <video className="media-preview-video" src={videoSrc} controls autoPlay loop muted />
          {audioSrc ? (
            <audio className="media-preview-audio" src={audioSrc} controls />
          ) : (
            <span className="muted media-preview-no-audio">该场景无音频</span>
          )}
        </div>
      )}
    </div>
  )
}

function ActionUploader({ petId, actionId, onUploaded }: { petId: string; actionId: string; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = { current: null as HTMLInputElement | null }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError('')
    setSuccess('')
    try {
      const formData = new FormData()
      formData.set('petId', petId)
      formData.set('actionId', actionId)
      formData.set('source', file)
      const result = await addActionVideo(formData)
      setSuccess(`第 ${result.sequence} 个视频上传成功`)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onUploaded()
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="action-uploader">
      <label className="action-upload-box">
        <input
          ref={(el) => { fileInputRef.current = el }}
          type="file"
          accept="video/webm"
          onChange={(e) => { setFile(e.target.files?.[0] || null); setError(''); setSuccess('') }}
          hidden
        />
        <CloudUpload size={18} />
        <span>{file ? file.name : '添加视频'}</span>
      </label>
      {file && (
        <button className="primary-button action-upload-btn" onClick={handleUpload} disabled={uploading} type="button">
          {uploading ? <Loader2 size={14} className="spin" /> : <CloudUpload size={14} />}
          {uploading ? '处理中…' : '上传'}
        </button>
      )}
      {error && <span className="action-upload-error">{error}</span>}
      {success && <span className="action-upload-success">{success}</span>}
    </div>
  )
}

function RoomsView({
  config,
  onChange,
  saving,
}: {
  config: BootstrapConfig
  onChange: (config: BootstrapConfig) => void
  saving: boolean
}) {
  const [editing, setEditing] = useState<RoomOption | null>(null)

  function toggleRoom(room: RoomOption) {
    onChange(toggleRoomEnabled(config, room.id))
  }

  function setDefault(room: RoomOption) {
    onChange(setDefaultRoom(config, room.id))
  }

  function deleteRoom(room: RoomOption) {
    if (!window.confirm(`确认从配置中删除「${room.name || room.id}」？\n云存储里的素材不会删除，仅从启动配置移除。`)) return
    onChange(removeRoom(config, room.id))
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>背景列表</h2>
        <button className="primary-button" onClick={() => setEditing(emptyRoom())} type="button">
          新增背景
        </button>
      </div>
      <DataTable
        columns={['状态', '预览', '名称', '类型', 'ID', '默认', '操作']}
        rows={config.rooms.map((room) => [
          <StatusPill enabled={room.enabled !== false} />,
          <PreviewImage alt={room.name} src={room.thumbUrl || (room.kind === 'image' ? room.mediaUrl : '')} />,
          room.name,
          room.kind === 'image' ? '图片' : '视频',
          <CodeText value={room.id} />,
          config.defaultRoomId === room.id ? <StarLabel /> : '否',
          <div className="row-actions">
            <button onClick={() => setEditing(room)} type="button">编辑</button>
            <button
              disabled={config.defaultRoomId === room.id || room.enabled === false}
              onClick={() => setDefault(room)}
              title={room.enabled === false ? '需要先启用才能设为默认' : ''}
              type="button"
            >
              设默认
            </button>
            <button onClick={() => toggleRoom(room)} type="button">{room.enabled === false ? '显示' : '隐藏'}</button>
            <button className="danger-button" onClick={() => deleteRoom(room)} type="button" title="删除背景">
              <Trash2 size={14} />
            </button>
            {isOpenableUrl(room.mediaUrl) && (
              <button onClick={() => openUrl(room.mediaUrl)} title="打开媒体地址" type="button">
                <ExternalLink size={14} />
              </button>
            )}
          </div>,
        ])}
      />
      {editing && (
        <RoomEditor
          room={editing}
          config={config}
          saving={saving}
          onCancel={() => setEditing(null)}
          onSave={(room) => {
            onChange(upsertRoom(config, room))
            setEditing(null)
          }}
        />
      )}
    </section>
  )
}

function HomeView({
  config,
  onChange,
  saving,
}: {
  config: BootstrapConfig
  onChange: (config: BootstrapConfig) => void
  saving: boolean
}) {
  const [draft, setDraft] = useState(() => cloneConfig(config))

  useEffect(() => {
    setDraft(cloneConfig(config))
  }, [config])

  function submit(event: FormEvent) {
    event.preventDefault()
    onChange(draft)
  }

  return (
    <form className="panel form-grid" onSubmit={submit}>
      <h2>首页配置</h2>
      <TextField
        label="应用名称"
        value={draft.appName}
        onChange={(value) => setDraft({ ...draft, appName: value })}
      />
      <TextField
        label="首页提示"
        value={draft.homeHint}
        onChange={(value) => setDraft({ ...draft, homeHint: value })}
      />
      <SelectField
        label="默认宠物"
        value={draft.defaultPetId}
        options={draft.pets
          .filter((pet) => pet.enabled !== false)
          .map((pet) => ({ value: pet.id, label: pet.name }))}
        onChange={(value) => {
          setDraft(setDefaultPet(draft, value))
        }}
      />
      <SelectField
        label="默认背景"
        value={draft.defaultRoomId}
        options={draft.rooms
          .filter((room) => room.enabled !== false)
          .map((room) => ({ value: room.id, label: room.name }))}
        onChange={(value) => {
          setDraft(setDefaultRoom(draft, value))
        }}
      />
      <TextField
        label="背景视频 URL"
        value={draft.homeMedia.backgroundVideoUrl}
        onChange={(value) =>
          setDraft({ ...draft, homeMedia: { ...draft.homeMedia, backgroundVideoUrl: value } })
        }
      />
      <TextField
        label="默认宠物视频 URL"
        value={draft.homeMedia.petVideoUrl}
        onChange={(value) =>
          setDraft({ ...draft, homeMedia: { ...draft.homeMedia, petVideoUrl: value } })
        }
      />
      <TextField
        label="倾听光球视频"
        value={draft.homeMedia.listenOrbVideoUrl}
        onChange={(value) =>
          setDraft({ ...draft, homeMedia: { ...draft.homeMedia, listenOrbVideoUrl: value } })
        }
      />
      <TextField
        label="会员卡标题"
        value={draft.settings.miniAd.title}
        onChange={(value) =>
          setDraft({
            ...draft,
            settings: { ...draft.settings, miniAd: { ...draft.settings.miniAd, title: value } },
          })
        }
      />
      <TextField
        label="会员卡文案"
        value={draft.settings.miniAd.copy}
        onChange={(value) =>
          setDraft({
            ...draft,
            settings: { ...draft.settings, miniAd: { ...draft.settings.miniAd, copy: value } },
          })
        }
      />
      <label className="check-field">
        <input
          checked={draft.settings.miniAd.enabled}
          onChange={(event) =>
            setDraft({
              ...draft,
              settings: {
                ...draft.settings,
                miniAd: { ...draft.settings.miniAd, enabled: event.target.checked },
              },
            })
          }
          type="checkbox"
        />
        展示会员小卡片
      </label>
      <fieldset className="visibility-fieldset">
        <legend>设置项可见性</legend>
        {draft.settings.items
          .filter((item) => ['sound', 'voice', 'privacy'].includes(item.id))
          .map((item) => (
            <label key={item.id} className="check-field">
              <input
                checked={item.visible !== false}
                onChange={(event) => {
                  const items = draft.settings.items.map((si) =>
                    si.id === item.id ? { ...si, visible: event.target.checked } : si,
                  )
                  setDraft({ ...draft, settings: { ...draft.settings, items } })
                }}
                type="checkbox"
              />
              展示「{item.title}」
            </label>
          ))}
      </fieldset>
      <button className="primary-button form-submit" disabled={saving} type="submit">
        {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
        保存到草稿
      </button>
    </form>
  )
}

function MediaView({ onState }: { onState: (state: AdminState) => void }) {
  const [petId, setPetId] = useState('')
  const [petName, setPetName] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<MediaCreateResult | null>(null)
  const [inspectResult, setInspectResult] = useState<MediaInspectResult | null>(null)
  const mediaMutation = useMutation({ mutationFn: createPetFromWebm })
  const inspectMutation = useMutation({ mutationFn: inspectPetWebm })

  async function inspectOnly() {
    if (!file) return
    const formData = new FormData()
    formData.set('source', file)
    const output = await inspectMutation.mutateAsync(formData)
    setInspectResult(output)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    if (!petId.trim() || !petName.trim()) return

    const formData = new FormData()
    formData.set('petId', petId.trim())
    formData.set('name', petName.trim())
    formData.set('subtitle', subtitle.trim())
    formData.set('source', file)

    const output = await mediaMutation.mutateAsync(formData)
    setResult(output)
    setInspectResult(output.inspect)
    onState(output.state)
  }

  const canSubmit = Boolean(file) && Boolean(petId.trim()) && Boolean(petName.trim())

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>创建新宠物</h2>
        <span className="muted">上传 idle WebM 创建全新宠物，处理后写入草稿</span>
      </div>
      <form className="form-grid" onSubmit={submit}>
        <TextField label="宠物 ID" value={petId} onChange={setPetId} placeholder="maolizi" />
        <TextField label="宠物名称" value={petName} onChange={setPetName} placeholder="毛栗子" />
        <TextField label="副标题" value={subtitle} onChange={setSubtitle} placeholder="圆脸热情" />
        <label className="field">
          <span>WebM 源素材</span>
          <input accept="video/webm" onChange={(event) => setFile(event.target.files?.[0] || null)} type="file" />
        </label>
        <div className="button-row">
          <button
            className="secondary-button"
            disabled={inspectMutation.isPending || !file}
            onClick={inspectOnly}
            type="button"
          >
            {inspectMutation.isPending ? <Loader2 className="spin" size={16} /> : <ListChecks size={16} />}
            仅验收
          </button>
          <button className="primary-button" disabled={mediaMutation.isPending || !canSubmit} type="submit">
            {mediaMutation.isPending ? <Loader2 className="spin" size={16} /> : <CloudUpload size={16} />}
            上传并处理
          </button>
        </div>
      </form>
      {inspectMutation.error && <div className="error-state">{inspectMutation.error.message}</div>}
      {mediaMutation.error && <div className="error-state">{mediaMutation.error.message}</div>}
      {inspectResult && <InspectSummary inspect={inspectResult} />}
      {result && (
        <div className="result-box ok">
          <CheckCircle2 size={18} />
          <div>
            <strong>{result.pet.name} 已处理并写入草稿</strong>
            <span>视频：{result.output.videoUrl}</span>
            <span>预览：{result.output.thumbUrl}</span>
            <span>manifest：{result.manifest.manifestVersion}</span>
            {result.draftIssues.length > 0 && (
              <span className="warn-text">草稿仍有 {result.draftIssues.length} 项校验问题，请到「发布中心」查看</span>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function PublishView({
  state,
  draft,
  published,
  issues,
  onPublish,
  onDiscard,
  onRollback,
  publishing,
  discarding,
  rolling,
}: {
  state: AdminState
  draft: BootstrapConfig | undefined
  published: BootstrapConfig
  issues: ValidationIssue[]
  onPublish: (summary: string) => void
  onDiscard: () => void
  onRollback: (versionId: string) => void
  publishing: boolean
  discarding: boolean
  rolling: boolean
}) {
  const [summary, setSummary] = useState('')
  const diffEntries = useMemo(() => diffConfigs(published, draft || null), [published, draft])
  const autoSummary = useMemo(() => generateDiffSummary(published, draft || null), [published, draft])

  return (
    <section className="grid">
      <div className="panel">
        <div className="panel-head">
          <h2>发布</h2>
          <DraftBadge state={state} saving={false} />
        </div>
        {!state.hasDraft && (
          <span className="muted">当前没有草稿。改动配置会自动写入草稿，再回到这里发布。</span>
        )}
        {state.hasDraft && !state.hasDraftChanges && (
          <span className="muted">草稿和当前线上配置一致，无需发布。可以丢弃草稿。</span>
        )}
        {state.hasDraftChanges && (
          <>
            <DiffList entries={diffEntries} />
            {autoSummary && (
              <div className="auto-summary">
                <strong>变更摘要</strong>
                <span>{autoSummary}</span>
              </div>
            )}
            {issues.length > 0 && (
              <div className="issue-list">
                {issues.map((issue) => (
                  <div key={`${issue.field}-${issue.message}`}>{issue.message}</div>
                ))}
              </div>
            )}
            <label className="field">
              <span>发布说明</span>
              <input
                placeholder="例如：上线毛栗子的 idle 素材"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </label>
            <div className="button-row">
              <button
                className="primary-button"
                disabled={publishing || issues.length > 0}
                onClick={() => {
                  const parts = [autoSummary, summary.trim()].filter(Boolean)
                  onPublish(parts.join(' · '))
                }}
                type="button"
              >
                {publishing ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                发布到线上
              </button>
              <button
                className="secondary-button"
                disabled={discarding}
                onClick={() => {
                  if (window.confirm('确认丢弃草稿？所有未发布改动将被舍弃。')) onDiscard()
                }}
                type="button"
              >
                {discarding ? <Loader2 className="spin" size={16} /> : <Undo2 size={16} />}
                丢弃草稿
              </button>
            </div>
          </>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>历史版本</h2>
          <span className="muted">最近 20 条</span>
        </div>
        {state.versions.length === 0 ? (
          <span className="muted">还没有发布过</span>
        ) : (
          <div className="audit-list">
            {state.versions.map((version) => (
              <div className="audit-item" key={version.version}>
                <strong>{version.summary || version.version}</strong>
                <span>{version.version}{version.rollbackOf ? ` · 回滚自 ${version.rollbackOf}` : ''}</span>
                <small>{formatTime(version.publishedAt)} / {version.publishedBy || 'admin'}</small>
                <div className="row-actions">
                  <button
                    disabled={rolling || version.version === published.configVersion}
                    onClick={() => {
                      if (window.confirm(`确认回滚到 ${version.version}？将创建新版本并替换当前线上。`)) {
                        onRollback(version.version)
                      }
                    }}
                    type="button"
                  >
                    <RotateCcw size={14} /> 回滚
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h2>操作日志</h2>
        <AuditList logs={state.auditLogs} />
      </div>
    </section>
  )
}

function DiffList({ entries }: { entries: ReturnType<typeof diffConfigs> }) {
  if (entries.length === 0) {
    return <span className="muted">没有结构化差异（可能只是 configVersion 变化）</span>
  }

  return (
    <div className="diff-list">
      <span className="muted">共 {entries.length} 处差异</span>
      {entries.slice(0, 50).map((entry) => (
        <div className="diff-row" key={entry.path}>
          <code className="code-text">{entry.path}</code>
          <div className="diff-values">
            <span className="diff-before">{formatDiffValue(entry.before)}</span>
            <span>→</span>
            <span className="diff-after">{formatDiffValue(entry.after)}</span>
          </div>
        </div>
      ))}
      {entries.length > 50 && <span className="muted">仅显示前 50 处差异</span>}
    </div>
  )
}

function formatDiffValue(value: unknown): string {
  if (value === undefined) return '∅'
  if (value === null) return 'null'
  if (typeof value === 'string') return `"${value}"`
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    const text = JSON.stringify(value)
    return text.length > 80 ? `${text.slice(0, 77)}…` : text
  } catch {
    return String(value)
  }
}

function PetEditor({
  pet,
  config,
  saving,
  onCancel,
  onSave,
}: {
  pet: PetOption
  config: BootstrapConfig
  saving: boolean
  onCancel: () => void
  onSave: (pet: PetOption) => void
}) {
  const [draft, setDraft] = useState<PetOption>({ ...pet })
  const isExisting = config.pets.some((item) => item.id === pet.id)

  const localIssues = useMemo(() => {
    const errors: string[] = []
    if (!draft.id.trim()) errors.push('ID 不能为空')
    if (!draft.name.trim()) errors.push('名称不能为空')
    if (!isExisting && config.pets.some((item) => item.id === draft.id.trim())) {
      errors.push(`ID ${draft.id.trim()} 已存在`)
    }
    return errors
  }, [draft, config, isExisting])

  return (
    <EditorShell title={isExisting ? '编辑宠物' : '新增宠物'} onCancel={onCancel}>
      <TextField
        disabled={isExisting}
        label="ID"
        value={draft.id}
        onChange={(value) => setDraft({ ...draft, id: normalizeIdInput(value) })}
      />
      <TextField label="名称" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
      <TextField label="副标题" value={draft.subtitle} onChange={(value) => setDraft({ ...draft, subtitle: value })} />
      <NumberField
        label="排序"
        value={draft.frameOffset || 0}
        onChange={(value) => setDraft({ ...draft, frameOffset: value })}
      />
      <TextField
        label="manifestKey"
        value={draft.manifestKey || ''}
        onChange={(value) => setDraft({ ...draft, manifestKey: value })}
      />
      <TextField
        label="视频 URL"
        value={draft.videoUrl || ''}
        onChange={(value) => setDraft({ ...draft, videoUrl: value })}
      />
      <TextField
        label="预览图 URL"
        value={draft.thumbUrl || ''}
        onChange={(value) => setDraft({ ...draft, thumbUrl: value })}
      />
      <TextField
        label="倾听图 URL"
        value={draft.listenFrameUrl || ''}
        onChange={(value) => setDraft({ ...draft, listenFrameUrl: value })}
      />
      <TextField
        label="音频 URL"
        value={draft.audioUrl || ''}
        onChange={(value) => setDraft({ ...draft, audioUrl: value })}
      />
      {draft.audioUrl && (
        <CloudLink fileID={draft.audioUrl} label="试听音频" />
      )}
      <label className="check-field">
        <input
          checked={draft.enabled !== false}
          onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
          type="checkbox"
        />
        展示
      </label>
      {localIssues.length > 0 && (
        <div className="issue-list">
          {localIssues.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </div>
      )}
      <button
        className="primary-button form-submit"
        disabled={saving || localIssues.length > 0}
        onClick={() =>
          onSave({
            ...draft,
            id: draft.id.trim(),
            manifestKey: draft.manifestKey || `${draft.id.trim()}/manifest.json`,
          })
        }
        type="button"
      >
        {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
        保存到草稿
      </button>
      <span className="muted">
        当前默认宠物：{config.pets.find((item) => item.id === config.defaultPetId)?.name || '-'}
      </span>
    </EditorShell>
  )
}

function RoomEditor({
  room,
  config,
  saving,
  onCancel,
  onSave,
}: {
  room: RoomOption
  config: BootstrapConfig
  saving: boolean
  onCancel: () => void
  onSave: (room: RoomOption) => void
}) {
  const [draft, setDraft] = useState<RoomOption>({ ...room })
  const isExisting = config.rooms.some((item) => item.id === room.id)
  const [file, setFile] = useState<File | null>(null)
  const [uploadResult, setUploadResult] = useState<RoomMediaCreateResult | null>(null)
  const roomMediaMutation = useMutation({ mutationFn: createRoomFromMedia })

  async function createRoom() {
    if (!file) return
    if (!draft.name.trim()) return

    const formData = new FormData()
    formData.set('name', draft.name.trim())
    formData.set('subtitle', draft.subtitle.trim())
    formData.set('source', file)

    const output = await roomMediaMutation.mutateAsync(formData)
    setUploadResult(output)
    onSave(output.room)
  }

  return (
    <EditorShell title={isExisting ? '编辑背景' : '新增背景'} onCancel={onCancel}>
      <TextField label="名称" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
      <TextField
        label="副标题"
        value={draft.subtitle}
        onChange={(value) => setDraft({ ...draft, subtitle: value })}
      />
      {isExisting ? (
        <>
          <ReadOnlyField label="ID" value={draft.id} />
          <ReadOnlyField label="类型" value={draft.kind === 'image' ? '图片' : '视频'} />
          <ReadOnlyField label="媒体地址" value={draft.mediaUrl} />
          {draft.thumbUrl && <ReadOnlyField label="预览地址" value={draft.thumbUrl} />}
        </>
      ) : (
        <>
          <label className="field">
            <span>背景素材</span>
            <input
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              type="file"
            />
          </label>
          {uploadResult && (
            <div className="result-box ok">
              <CheckCircle2 size={18} />
              <div>
                <strong>{uploadResult.room.name} 已上传</strong>
                <span>{uploadResult.upload.mediaUrl}</span>
              </div>
            </div>
          )}
          {roomMediaMutation.error && <div className="error-state">{roomMediaMutation.error.message}</div>}
        </>
      )}
      <label className="check-field">
        <input
          checked={draft.enabled !== false}
          onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
          type="checkbox"
        />
        展示
      </label>
      {isExisting ? (
        <button
          className="primary-button form-submit"
          disabled={saving || !draft.name.trim()}
          onClick={() => onSave(draft)}
          type="button"
        >
          {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
          保存到草稿
        </button>
      ) : (
        <button
          className="primary-button form-submit"
          disabled={roomMediaMutation.isPending || saving || !file || !draft.name.trim()}
          onClick={createRoom}
          type="button"
        >
          {roomMediaMutation.isPending || saving ? (
            <Loader2 className="spin" size={16} />
          ) : (
            <CloudUpload size={16} />
          )}
          上传并写入草稿
        </button>
      )}
      <span className="muted">
        当前默认背景：{config.rooms.find((item) => item.id === config.defaultRoomId)?.name || '-'}
      </span>
    </EditorShell>
  )
}

function InspectSummary({ inspect }: { inspect: MediaInspectResult }) {
  return (
    <div className={`inspect-box ${inspect.ok ? 'ok' : 'warn'}`}>
      <strong>{inspect.ok ? '素材验收通过' : '素材未通过验收'}</strong>
      <span>
        {inspect.source.codec} / {inspect.source.width}x{inspect.source.height} /{' '}
        {inspect.source.fps.toFixed(2)}fps / {inspect.source.duration.toFixed(2)}s
      </span>
      <span>
        alpha：YMIN {inspect.source.alphaYMin ?? '-'} / YMAX {inspect.source.alphaYMax ?? '-'}
      </span>
      {inspect.warnings.map((warning) => (
        <span key={warning}>{warning}</span>
      ))}
    </div>
  )
}

function AuditList({ logs }: { logs: AdminAuditLog[] }) {
  if (!logs.length) {
    return <span className="muted">暂无操作日志</span>
  }

  return (
    <div className="audit-list">
      {logs.map((log) => (
        <div className="audit-item" key={log.id}>
          <strong>{log.summary || log.action}</strong>
          <span>
            {log.action} / {log.target}
          </span>
          <small>
            {formatTime(log.createdAt)} / {log.actor || 'admin'}
          </small>
        </div>
      ))}
    </div>
  )
}

function EditorShell({
  title,
  children,
  onCancel,
}: {
  title: string
  children: React.ReactNode
  onCancel: () => void
}) {
  return (
    <div className="drawer">
      <div className="drawer-card">
        <div className="panel-head">
          <h2>{title}</h2>
          <button onClick={onCancel} type="button">关闭</button>
        </div>
        <div className="form-grid">{children}</div>
      </div>
    </div>
  )
}

function DataTable({
  columns,
  rows,
}: {
  columns: string[]
  rows: Array<Array<React.ReactNode>>
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusPill({ enabled }: { enabled: boolean }) {
  return (
    <span className={`status-pill ${enabled ? 'enabled' : 'disabled'}`}>
      {enabled ? '展示' : '隐藏'}
    </span>
  )
}

function StarLabel() {
  return (
    <span className="star-label">
      <Star size={14} />
      默认
    </span>
  )
}

function PreviewImage({ alt, src }: { alt: string; src?: string }) {
  if (!src || src.startsWith('cloud://') || src.startsWith('/pages/')) {
    return <div className="preview-fallback">{alt.slice(0, 1) || '-'}</div>
  }

  return <img alt={alt} className="preview-image" src={src} />
}

function CodeText({ value }: { value: string }) {
  return <code className="code-text">{value}</code>
}

function TextField({
  disabled,
  label,
  value,
  placeholder,
  onChange,
}: {
  disabled?: boolean
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
    </label>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input readOnly value={value} />
    </label>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function openUrl(url: string) {
  if (!isOpenableUrl(url)) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

function isOpenableUrl(url?: string) {
  return Boolean(url && /^https?:\/\//.test(url))
}

function normalizeIdInput(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
}

function formatTime(value: string): string {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function CloudLink({ fileID, label }: { fileID: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function resolve() {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }

    setLoading(true)
    try {
      const { resolveCloudUrl } = await import('./api')
      const result = await resolveCloudUrl(fileID)
      setUrl(result.url)
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      console.warn('resolve cloud url failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button className="secondary-button" disabled={loading} onClick={resolve} type="button">
      {loading ? <Loader2 className="spin" size={14} /> : <ExternalLink size={14} />}
      {label}
    </button>
  )
}
