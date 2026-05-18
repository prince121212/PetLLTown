import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  CloudUpload,
  ExternalLink,
  Home,
  Image,
  ListChecks,
  Loader2,
  PawPrint,
  RefreshCw,
  Save,
  Star,
} from 'lucide-react'
import { createPetFromWebm, createRoomFromMedia, getConfigState, inspectPetWebm, saveConfig } from './api'
import {
  cloneConfig,
  normalizeBootstrapConfig,
  setDefaultPet,
  setDefaultRoom,
  upsertPet,
  upsertRoom,
  validateConfig,
} from './configTools'
import {
  AdminAuditLog,
  BootstrapConfig,
  MediaCreateResult,
  MediaInspectResult,
  PetOption,
  RoomMediaCreateResult,
  RoomOption,
} from './types'

type RouteKey = 'dashboard' | 'pets' | 'rooms' | 'home' | 'media'

const navItems: Array<{ key: RouteKey; path: string; label: string; icon: typeof Home }> = [
  { key: 'dashboard', path: '/dashboard', label: '概览', icon: Home },
  { key: 'pets', path: '/pets', label: '宠物', icon: PawPrint },
  { key: 'rooms', path: '/rooms', label: '背景', icon: Image },
  { key: 'home', path: '/home', label: '首页配置', icon: ListChecks },
  { key: 'media', path: '/media', label: '素材自动化', icon: CloudUpload },
]

function emptyPet(): PetOption {
  return {
    id: '',
    name: '',
    subtitle: '',
    frameOffset: 0,
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
  const stateQuery = useQuery({
    queryKey: ['config-state'],
    queryFn: getConfigState,
  })
  const saveMutation = useMutation({
    mutationFn: saveConfig,
    onSuccess: (data) => queryClient.setQueryData(['config-state'], data),
  })

  const configState = stateQuery.data
  const config = useMemo(
    () => (configState?.config ? normalizeBootstrapConfig(configState.config) : undefined),
    [configState?.config],
  )
  const title = navItems.find((item) => location.pathname.startsWith(item.path))?.label || '概览'
  const issues = useMemo(() => (config ? validateConfig(config) : []), [config])

  function updateConfig(next: BootstrapConfig) {
    saveMutation.mutate(next)
  }

  const mutationError = saveMutation.error

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
            return (
              <NavLink className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} key={item.key} to={item.path}>
                <Icon size={18} />
                <span>{item.label}</span>
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
              {configState?.meta?.envId ? `环境：${configState.meta.envId}` : '当前管理线上启动配置、宠物和背景素材。'}
            </p>
          </div>
          <button className="icon-button" onClick={() => stateQuery.refetch()} title="刷新配置" type="button">
            <RefreshCw size={18} />
          </button>
        </header>

        {stateQuery.isLoading && (
          <div className="empty-state">
            <Loader2 className="spin" size={24} />
            <span>正在读取配置</span>
          </div>
        )}

        {stateQuery.error && (
          <div className="error-state">{stateQuery.error instanceof Error ? stateQuery.error.message : '配置读取失败'}</div>
        )}

        {mutationError && (
          <div className="error-state">{mutationError instanceof Error ? mutationError.message : '操作失败'}</div>
        )}

        {config && configState && (
          <Routes>
            <Route path="/" element={<Navigate replace to="/dashboard" />} />
            <Route
              path="/dashboard"
              element={
                <Dashboard
                  auditLogs={configState.auditLogs || []}
                  config={config}
                  issues={issues}
                />
              }
            />
            <Route path="/pets" element={<PetsView config={config} onChange={updateConfig} saving={saveMutation.isPending} />} />
            <Route path="/rooms" element={<RoomsView config={config} onChange={updateConfig} saving={saveMutation.isPending} />} />
            <Route path="/home" element={<HomeView config={config} onChange={updateConfig} saving={saveMutation.isPending} />} />
            <Route path="/media" element={<MediaView config={config} onChange={updateConfig} />} />
            <Route path="*" element={<Navigate replace to="/dashboard" />} />
          </Routes>
        )}
      </main>
    </div>
  )
}

function Dashboard({
  auditLogs,
  config,
  issues,
}: {
  auditLogs: AdminAuditLog[]
  config: BootstrapConfig
  issues: ReturnType<typeof validateConfig>
}) {
  const enabledPets = config.pets.filter((pet) => pet.enabled !== false)
  const enabledRooms = config.rooms.filter((room) => room.enabled !== false)

  return (
    <section className="grid metrics-grid">
      <Metric title="启用宠物" value={`${enabledPets.length}/${config.pets.length}`} />
      <Metric title="启用背景" value={`${enabledRooms.length}/${config.rooms.length}`} />
      <Metric title="配置状态" value="直接生效" tone="ok" />
      <Metric title="校验问题" value={`${issues.length}`} tone={issues.length ? 'warn' : 'ok'} />
      <div className="panel span-2">
        <h2>当前默认</h2>
        <div className="summary-list">
          <span>默认宠物：{config.pets.find((pet) => pet.id === config.defaultPetId)?.name || config.defaultPetId}</span>
          <span>默认背景：{config.rooms.find((room) => room.id === config.defaultRoomId)?.name || config.defaultRoomId}</span>
          <span>首页提示：{config.homeHint}</span>
          <span>配置版本：{config.configVersion}</span>
        </div>
      </div>
      <div className="panel span-2">
        <h2>配置校验</h2>
        {issues.length === 0 ? (
          <div className="result-box ok"><CheckCircle2 size={18} />当前配置可用</div>
        ) : (
          <div className="issue-list">
            {issues.map((issue) => (
              <div key={`${issue.field}-${issue.message}`}>{issue.message}</div>
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

function PetsView({ config, onChange, saving }: { config: BootstrapConfig; onChange: (config: BootstrapConfig) => void; saving: boolean }) {
  const [editing, setEditing] = useState<PetOption | null>(null)

  function togglePet(pet: PetOption) {
    const next = cloneConfig(config)
    next.pets = next.pets.map((item) => (item.id === pet.id ? { ...item, enabled: item.enabled === false } : item))
    const defaultPet = next.pets.find((item) => item.id === next.defaultPetId)

    if (!defaultPet || defaultPet.enabled === false) {
      const fallback = next.pets.find((item) => item.enabled !== false)

      if (fallback) {
        next.defaultPetId = fallback.id
        next.defaultPetName = fallback.name
        next.homeMedia.petVideoUrl = fallback.videoUrl || next.homeMedia.petVideoUrl
      }
    }

    onChange(next)
  }

  function setDefault(pet: PetOption) {
    onChange(setDefaultPet(config, pet.id))
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>宠物列表</h2>
        <button className="primary-button" onClick={() => setEditing(emptyPet())} type="button">新增宠物</button>
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
            <button onClick={() => setEditing(pet)} type="button">编辑</button>
            <button disabled={config.defaultPetId === pet.id || pet.enabled === false} onClick={() => setDefault(pet)} type="button">设默认</button>
            <button onClick={() => togglePet(pet)} type="button">{pet.enabled === false ? '显示' : '隐藏'}</button>
            {isOpenableUrl(pet.videoUrl) && (
              <button onClick={() => openUrl(pet.videoUrl || '')} title="打开视频地址" type="button">
                <ExternalLink size={14} />
              </button>
            )}
          </div>,
        ])}
      />
      {editing && (
        <PetEditor
          pet={editing}
          config={config}
          saving={saving}
          onCancel={() => setEditing(null)}
          onSave={(pet) => {
            const next = upsertPet(config, pet)
            onChange(next)
            setEditing(null)
          }}
        />
      )}
    </section>
  )
}

function RoomsView({ config, onChange, saving }: { config: BootstrapConfig; onChange: (config: BootstrapConfig) => void; saving: boolean }) {
  const [editing, setEditing] = useState<RoomOption | null>(null)

  function toggleRoom(room: RoomOption) {
    const next = cloneConfig(config)
    next.rooms = next.rooms.map((item) => (item.id === room.id ? { ...item, enabled: item.enabled === false } : item))
    const defaultRoom = next.rooms.find((item) => item.id === next.defaultRoomId)

    if (!defaultRoom || defaultRoom.enabled === false) {
      const fallback = next.rooms.find((item) => item.enabled !== false)

      if (fallback) {
        next.defaultRoomId = fallback.id
        next.homeMedia.backgroundVideoUrl = fallback.mediaUrl || next.homeMedia.backgroundVideoUrl
      }
    }

    onChange(next)
  }

  function setDefault(room: RoomOption) {
    onChange(setDefaultRoom(config, room.id))
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>背景列表</h2>
        <button className="primary-button" onClick={() => setEditing(emptyRoom())} type="button">新增背景</button>
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
            <button disabled={config.defaultRoomId === room.id || room.enabled === false} onClick={() => setDefault(room)} type="button">设默认</button>
            <button onClick={() => toggleRoom(room)} type="button">{room.enabled === false ? '显示' : '隐藏'}</button>
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
            const next = upsertRoom(config, room)
            onChange(next)
            setEditing(null)
          }}
        />
      )}
    </section>
  )
}

function HomeView({ config, onChange, saving }: { config: BootstrapConfig; onChange: (config: BootstrapConfig) => void; saving: boolean }) {
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
      <TextField label="应用名称" value={draft.appName} onChange={(value) => setDraft({ ...draft, appName: value })} />
      <TextField label="首页提示" value={draft.homeHint} onChange={(value) => setDraft({ ...draft, homeHint: value })} />
      <SelectField
        label="默认宠物"
        value={draft.defaultPetId}
        options={draft.pets.filter((pet) => pet.enabled !== false).map((pet) => ({ value: pet.id, label: pet.name }))}
        onChange={(value) => {
          const next = setDefaultPet(draft, value)
          setDraft(next)
        }}
      />
      <SelectField
        label="默认背景"
        value={draft.defaultRoomId}
        options={draft.rooms.filter((room) => room.enabled !== false).map((room) => ({ value: room.id, label: room.name }))}
        onChange={(value) => {
          const next = setDefaultRoom(draft, value)
          setDraft(next)
        }}
      />
      <TextField
        label="背景视频 URL"
        value={draft.homeMedia.backgroundVideoUrl}
        onChange={(value) => setDraft({ ...draft, homeMedia: { ...draft.homeMedia, backgroundVideoUrl: value } })}
      />
      <TextField
        label="默认宠物视频 URL"
        value={draft.homeMedia.petVideoUrl}
        onChange={(value) => setDraft({ ...draft, homeMedia: { ...draft.homeMedia, petVideoUrl: value } })}
      />
      <TextField
        label="倾听光球视频"
        value={draft.homeMedia.listenOrbVideoUrl}
        onChange={(value) => setDraft({ ...draft, homeMedia: { ...draft.homeMedia, listenOrbVideoUrl: value } })}
      />
      <TextField
        label="会员卡标题"
        value={draft.settings.miniAd.title}
        onChange={(value) => setDraft({ ...draft, settings: { ...draft.settings, miniAd: { ...draft.settings.miniAd, title: value } } })}
      />
      <TextField
        label="会员卡文案"
        value={draft.settings.miniAd.copy}
        onChange={(value) => setDraft({ ...draft, settings: { ...draft.settings, miniAd: { ...draft.settings.miniAd, copy: value } } })}
      />
      <label className="check-field">
        <input
          checked={draft.settings.miniAd.enabled}
          onChange={(event) => setDraft({ ...draft, settings: { ...draft.settings, miniAd: { ...draft.settings.miniAd, enabled: event.target.checked } } })}
          type="checkbox"
        />
        展示会员小卡片
      </label>
      <button className="primary-button form-submit" disabled={saving} type="submit">
        {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
        保存并生效
      </button>
    </form>
  )
}

function MediaView({ config, onChange }: { config: BootstrapConfig; onChange: (config: BootstrapConfig) => void }) {
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

    const formData = new FormData()
    formData.set('petId', petId)
    formData.set('name', petName)
    formData.set('subtitle', subtitle)
    formData.set('source', file)

    const output = await mediaMutation.mutateAsync(formData)
    setResult(output)
    setInspectResult(output.inspect)
    onChange(upsertPet(config, output.pet))
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>宠物素材自动化</h2>
        <span className="muted">第一版支持单个 idle WebM</span>
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
          <button className="secondary-button" disabled={inspectMutation.isPending || !file} onClick={inspectOnly} type="button">
            {inspectMutation.isPending ? <Loader2 className="spin" size={16} /> : <ListChecks size={16} />}
            仅验收
          </button>
          <button className="primary-button" disabled={mediaMutation.isPending || !file} type="submit">
            {mediaMutation.isPending ? <Loader2 className="spin" size={16} /> : <CloudUpload size={16} />}
            上传并处理
          </button>
        </div>
      </form>
      {inspectMutation.error && <div className="error-state">{inspectMutation.error.message}</div>}
      {mediaMutation.error && <div className="error-state">{mediaMutation.error.message}</div>}
      {inspectResult && <InspectSummary inspect={inspectResult} />}
      {result && (
        <div className="result-box">
          <CheckCircle2 size={18} />
          <div>
            <strong>{result.pet.name} 已生成并保存</strong>
            <span>视频：{result.output.videoUrl}</span>
            <span>预览：{result.output.thumbUrl}</span>
            <span>manifest：{result.manifest.manifestVersion}</span>
          </div>
        </div>
      )}
    </section>
  )
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

  return (
    <EditorShell title="编辑宠物" onCancel={onCancel}>
      <TextField disabled={isExisting} label="ID" value={draft.id} onChange={(value) => setDraft({ ...draft, id: normalizeIdInput(value) })} />
      <TextField label="名称" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
      <TextField label="副标题" value={draft.subtitle} onChange={(value) => setDraft({ ...draft, subtitle: value })} />
      <NumberField label="排序" value={draft.frameOffset || 0} onChange={(value) => setDraft({ ...draft, frameOffset: value })} />
      <TextField label="manifestKey" value={draft.manifestKey || ''} onChange={(value) => setDraft({ ...draft, manifestKey: value })} />
      <TextField label="视频 URL" value={draft.videoUrl || ''} onChange={(value) => setDraft({ ...draft, videoUrl: value })} />
      <TextField label="预览图 URL" value={draft.thumbUrl || ''} onChange={(value) => setDraft({ ...draft, thumbUrl: value })} />
      <TextField label="倾听图 URL" value={draft.listenFrameUrl || ''} onChange={(value) => setDraft({ ...draft, listenFrameUrl: value })} />
      <label className="check-field">
        <input checked={draft.enabled !== false} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} type="checkbox" />
        展示
      </label>
      <button
        className="primary-button form-submit"
        disabled={saving}
        onClick={() => onSave({ ...draft, manifestKey: draft.manifestKey || `${draft.id}/manifest.json` })}
        type="button"
      >
        {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
        保存
      </button>
      <span className="muted">当前默认宠物：{config.pets.find((item) => item.id === config.defaultPetId)?.name}</span>
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

    const formData = new FormData()
    formData.set('name', draft.name)
    formData.set('subtitle', draft.subtitle)
    formData.set('source', file)

    const output = await roomMediaMutation.mutateAsync(formData)
    setUploadResult(output)
    onSave(output.room)
  }

  return (
    <EditorShell title={isExisting ? '编辑背景' : '新增背景'} onCancel={onCancel}>
      <TextField label="名称" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
      <TextField label="副标题" value={draft.subtitle} onChange={(value) => setDraft({ ...draft, subtitle: value })} />
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
        <input checked={draft.enabled !== false} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} type="checkbox" />
        展示
      </label>
      {isExisting ? (
        <button className="primary-button form-submit" disabled={saving} onClick={() => onSave(draft)} type="button">
          {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
          保存
        </button>
      ) : (
        <button className="primary-button form-submit" disabled={roomMediaMutation.isPending || saving || !file || !draft.name.trim()} onClick={createRoom} type="button">
          {roomMediaMutation.isPending || saving ? <Loader2 className="spin" size={16} /> : <CloudUpload size={16} />}
          上传并保存
        </button>
      )}
      <span className="muted">当前默认背景：{config.rooms.find((item) => item.id === config.defaultRoomId)?.name}</span>
    </EditorShell>
  )
}

function InspectSummary({ inspect }: { inspect: MediaInspectResult }) {
  return (
    <div className={`inspect-box ${inspect.ok ? 'ok' : 'warn'}`}>
      <strong>{inspect.ok ? '素材验收通过' : '素材未通过验收'}</strong>
      <span>
        {inspect.source.codec} / {inspect.source.width}x{inspect.source.height} / {inspect.source.fps.toFixed(2)}fps / {inspect.source.duration.toFixed(2)}s
      </span>
      <span>alpha：YMIN {inspect.source.alphaYMin ?? '-'} / YMAX {inspect.source.alphaYMax ?? '-'}</span>
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
          <span>{log.action} / {log.target}</span>
          <small>{formatTime(log.createdAt)} / {log.actor || 'admin'}</small>
        </div>
      ))}
    </div>
  )
}

function EditorShell({ title, children, onCancel }: { title: string; children: React.ReactNode; onCancel: () => void }) {
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

function DataTable({ columns, rows }: { columns: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusPill({ enabled }: { enabled: boolean }) {
  return <span className={`status-pill ${enabled ? 'enabled' : 'disabled'}`}>{enabled ? '展示' : '隐藏'}</span>
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
      <input type="number" value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))} />
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
          <option key={option.value} value={option.value}>{option.label}</option>
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
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
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
