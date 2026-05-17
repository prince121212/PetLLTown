import { ChangeEvent, FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  CloudUpload,
  Home,
  Image,
  ListChecks,
  Loader2,
  PawPrint,
  RefreshCw,
  Rocket,
  Save,
} from 'lucide-react'
import { createPetFromWebm, getConfigState, publishDraft, rollbackVersion, saveDraft } from './api'
import { cloneConfig, upsertPet, upsertRoom, validateConfig } from './configTools'
import { BootstrapConfig, MediaCreateResult, PetOption, RoomOption } from './types'

type ViewKey = 'dashboard' | 'pets' | 'rooms' | 'home' | 'media' | 'publish'

const navItems: Array<{ key: ViewKey; label: string; icon: typeof Home }> = [
  { key: 'dashboard', label: '概览', icon: Home },
  { key: 'pets', label: '宠物', icon: PawPrint },
  { key: 'rooms', label: '背景', icon: Image },
  { key: 'home', label: '首页配置', icon: ListChecks },
  { key: 'media', label: '素材自动化', icon: CloudUpload },
  { key: 'publish', label: '发布', icon: Rocket },
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
  const [view, setView] = useState<ViewKey>('dashboard')
  const stateQuery = useQuery({
    queryKey: ['config-state'],
    queryFn: getConfigState,
  })
  const saveMutation = useMutation({
    mutationFn: saveDraft,
    onSuccess: (data) => queryClient.setQueryData(['config-state'], data),
  })
  const publishMutation = useMutation({
    mutationFn: publishDraft,
    onSuccess: (data) => queryClient.setQueryData(['config-state'], data),
  })
  const rollbackMutation = useMutation({
    mutationFn: rollbackVersion,
    onSuccess: (data) => queryClient.setQueryData(['config-state'], data),
  })

  const configState = stateQuery.data
  const config = configState?.draft
  const issues = useMemo(() => (config ? validateConfig(config) : []), [config])

  function updateConfig(next: BootstrapConfig) {
    saveMutation.mutate(next)
  }

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
              <button
                className={`nav-item ${view === item.key ? 'active' : ''}`}
                key={item.key}
                onClick={() => setView(item.key)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{navItems.find((item) => item.key === view)?.label}</h1>
            <p>当前管理线上启动配置、宠物和背景素材。</p>
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

        {config && (
          <>
            {view === 'dashboard' && <Dashboard config={config} hasDraft={configState?.hasDraft || false} issues={issues} />}
            {view === 'pets' && <PetsView config={config} onChange={updateConfig} saving={saveMutation.isPending} />}
            {view === 'rooms' && <RoomsView config={config} onChange={updateConfig} saving={saveMutation.isPending} />}
            {view === 'home' && <HomeView config={config} onChange={updateConfig} saving={saveMutation.isPending} />}
            {view === 'media' && <MediaView config={config} onChange={updateConfig} />}
            {view === 'publish' && (
              <PublishView
                config={config}
                issues={issues}
                versions={configState?.versions || []}
                publishing={publishMutation.isPending}
                rollingBack={rollbackMutation.isPending}
                onPublish={(summary) => publishMutation.mutate(summary)}
                onRollback={(versionId) => rollbackMutation.mutate(versionId)}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}

function Dashboard({ config, hasDraft, issues }: { config: BootstrapConfig; hasDraft: boolean; issues: ReturnType<typeof validateConfig> }) {
  const enabledPets = config.pets.filter((pet) => pet.enabled !== false)
  const enabledRooms = config.rooms.filter((room) => room.enabled !== false)

  return (
    <section className="grid metrics-grid">
      <Metric title="启用宠物" value={`${enabledPets.length}/${config.pets.length}`} />
      <Metric title="启用背景" value={`${enabledRooms.length}/${config.rooms.length}`} />
      <Metric title="草稿状态" value={hasDraft ? '有草稿' : '已同步'} />
      <Metric title="校验问题" value={`${issues.length}`} tone={issues.length ? 'warn' : 'ok'} />
      <div className="panel span-2">
        <h2>当前默认</h2>
        <div className="summary-list">
          <span>默认宠物：{config.pets.find((pet) => pet.id === config.defaultPetId)?.name || config.defaultPetId}</span>
          <span>默认背景：{config.rooms.find((room) => room.id === config.defaultRoomId)?.name || config.defaultRoomId}</span>
          <span>首页提示：{config.homeHint}</span>
        </div>
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
    onChange(next)
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>宠物列表</h2>
        <button className="primary-button" onClick={() => setEditing(emptyPet())} type="button">新增宠物</button>
      </div>
      <DataTable
        columns={['状态', '名称', '副标题', 'ID', '默认', '操作']}
        rows={config.pets.map((pet) => [
          <StatusPill enabled={pet.enabled !== false} />,
          pet.name,
          pet.subtitle,
          pet.id,
          config.defaultPetId === pet.id ? '是' : '否',
          <div className="row-actions">
            <button onClick={() => setEditing(pet)} type="button">编辑</button>
            <button onClick={() => togglePet(pet)} type="button">{pet.enabled === false ? '显示' : '隐藏'}</button>
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
    onChange(next)
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>背景列表</h2>
        <button className="primary-button" onClick={() => setEditing(emptyRoom())} type="button">新增背景</button>
      </div>
      <DataTable
        columns={['状态', '名称', '类型', 'ID', '默认', '操作']}
        rows={config.rooms.map((room) => [
          <StatusPill enabled={room.enabled !== false} />,
          room.name,
          room.kind,
          room.id,
          config.defaultRoomId === room.id ? '是' : '否',
          <div className="row-actions">
            <button onClick={() => setEditing(room)} type="button">编辑</button>
            <button onClick={() => toggleRoom(room)} type="button">{room.enabled === false ? '显示' : '隐藏'}</button>
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
          const pet = draft.pets.find((item) => item.id === value)
          setDraft({ ...draft, defaultPetId: value, defaultPetName: pet?.name || draft.defaultPetName })
        }}
      />
      <SelectField
        label="默认背景"
        value={draft.defaultRoomId}
        options={draft.rooms.filter((room) => room.enabled !== false).map((room) => ({ value: room.id, label: room.name }))}
        onChange={(value) => setDraft({ ...draft, defaultRoomId: value })}
      />
      <TextField
        label="倾听光球视频"
        value={draft.homeMedia.listenOrbVideoUrl}
        onChange={(value) => setDraft({ ...draft, homeMedia: { ...draft.homeMedia, listenOrbVideoUrl: value } })}
      />
      <button className="primary-button form-submit" disabled={saving} type="submit">
        <Save size={16} />
        保存草稿
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
  const mediaMutation = useMutation({ mutationFn: createPetFromWebm })

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
        <button className="primary-button form-submit" disabled={mediaMutation.isPending || !file} type="submit">
          {mediaMutation.isPending ? <Loader2 className="spin" size={16} /> : <CloudUpload size={16} />}
          上传并处理
        </button>
      </form>
      {mediaMutation.error && <div className="error-state">{mediaMutation.error.message}</div>}
      {result && (
        <div className="result-box">
          <CheckCircle2 size={18} />
          <div>
            <strong>{result.pet.name} 已生成素材草稿</strong>
            <span>视频：{result.output.videoUrl}</span>
            <span>预览：{result.output.thumbUrl}</span>
          </div>
        </div>
      )}
    </section>
  )
}

function PublishView({
  config,
  issues,
  versions,
  publishing,
  rollingBack,
  onPublish,
  onRollback,
}: {
  config: BootstrapConfig
  issues: ReturnType<typeof validateConfig>
  versions: Array<{ id: string; version: string; summary: string; publishedAt: string }>
  publishing: boolean
  rollingBack: boolean
  onPublish: (summary: string) => void
  onRollback: (versionId: string) => void
}) {
  const [summary, setSummary] = useState('')

  return (
    <section className="grid publish-grid">
      <div className="panel">
        <h2>发布检查</h2>
        {issues.length === 0 ? (
          <div className="result-box ok"><CheckCircle2 size={18} />配置可以发布</div>
        ) : (
          <div className="issue-list">
            {issues.map((issue) => (
              <div key={`${issue.field}-${issue.message}`}>{issue.message}</div>
            ))}
          </div>
        )}
        <TextField label="发布说明" value={summary} onChange={setSummary} placeholder="说明这次变更" />
        <button
          className="primary-button"
          disabled={publishing || issues.length > 0}
          onClick={() => onPublish(summary || `发布 ${config.configVersion}`)}
          type="button"
        >
          {publishing ? <Loader2 className="spin" size={16} /> : <Rocket size={16} />}
          发布草稿
        </button>
      </div>
      <div className="panel">
        <h2>版本记录</h2>
        <div className="version-list">
          {versions.map((version) => (
            <div className="version-item" key={version.id}>
              <div>
                <strong>{version.version}</strong>
                <span>{version.summary}</span>
              </div>
              <button disabled={rollingBack} onClick={() => onRollback(version.id)} type="button">回滚</button>
            </div>
          ))}
        </div>
      </div>
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

  return (
    <EditorShell title="编辑宠物" onCancel={onCancel}>
      <TextField label="ID" value={draft.id} onChange={(value) => setDraft({ ...draft, id: value })} />
      <TextField label="名称" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
      <TextField label="副标题" value={draft.subtitle} onChange={(value) => setDraft({ ...draft, subtitle: value })} />
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

  return (
    <EditorShell title="编辑背景" onCancel={onCancel}>
      <TextField label="ID" value={draft.id} onChange={(value) => setDraft({ ...draft, id: value })} />
      <TextField label="名称" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
      <TextField label="副标题" value={draft.subtitle} onChange={(value) => setDraft({ ...draft, subtitle: value })} />
      <SelectField
        label="类型"
        value={draft.kind}
        options={[{ value: 'image', label: '图片' }, { value: 'video', label: '视频' }]}
        onChange={(value) => setDraft({ ...draft, kind: value as RoomOption['kind'] })}
      />
      <TextField label="媒体 URL" value={draft.mediaUrl} onChange={(value) => setDraft({ ...draft, mediaUrl: value })} />
      <TextField label="预览 URL" value={draft.thumbUrl || ''} onChange={(value) => setDraft({ ...draft, thumbUrl: value })} />
      <label className="check-field">
        <input checked={draft.enabled !== false} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} type="checkbox" />
        展示
      </label>
      <button className="primary-button form-submit" disabled={saving} onClick={() => onSave(draft)} type="button">
        保存
      </button>
      <span className="muted">当前默认背景：{config.rooms.find((item) => item.id === config.defaultRoomId)?.name}</span>
    </EditorShell>
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

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input placeholder={placeholder} value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)} />
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
