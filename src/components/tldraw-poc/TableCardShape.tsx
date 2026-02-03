/**
 * TableCardShape - 表格卡片形状
 * 在画布上直接渲染 Agent 生成的表格数据
 * 支持多 sheet 标签页（类似 Excel 底部标签）
 */
import {
  ShapeUtil,
  TLBaseShape,
  HTMLContainer,
  Rectangle2d,
  Geometry2d,
} from 'tldraw'
import { useState, useCallback } from 'react'

/** 单个 sheet 的数据 */
interface SheetData {
  name: string
  headers: string[]
  rows: string[][]
}

export type TableCardShape = TLBaseShape<
  'table-card',
  {
    w: number
    h: number
    title: string
    headers: string   // JSON: string[] （单 sheet 兼容）
    rows: string      // JSON: string[][] （单 sheet 兼容）
    sheets: string    // JSON: SheetData[] （多 sheet）
    sourceTaskId: string
  }
>

/** 解析 sheets：优先用 sheets 字段，否则从 headers/rows 构建单 sheet */
function parseSheets(props: TableCardShape['props']): SheetData[] {
  // 优先解析 sheets
  if (props.sheets && props.sheets !== '[]') {
    try {
      const sheets = JSON.parse(props.sheets) as SheetData[]
      if (Array.isArray(sheets) && sheets.length > 0) return sheets
    } catch { /* */ }
  }
  // 回退：从 headers/rows 构建单 sheet
  let headers: string[] = []
  let rows: string[][] = []
  try { headers = JSON.parse(props.headers) } catch { /* */ }
  try { rows = JSON.parse(props.rows) } catch { /* */ }
  if (headers.length === 0 && rows.length === 0) return []
  return [{ name: props.title || '表格', headers, rows }]
}

/** 根据内容计算合适的尺寸 */
function computeSize(sheets: SheetData[]): { w: number; h: number } {
  if (sheets.length === 0) return { w: 480, h: 200 }
  // 取所有 sheet 中最大的列数和行数
  const maxCols = Math.max(...sheets.map(s => s.headers.length), 1)
  const maxRows = Math.max(...sheets.map(s => s.rows.length), 1)
  // 每列 160px，整体最小 400，最大 1200
  const w = Math.max(400, Math.min(1200, maxCols * 160 + 40))
  // 标题 44 + 表头 36 + 每行 36 + 标签栏 36 + padding 12
  const tabBarH = sheets.length > 1 ? 36 : 0
  const h = 44 + 36 + maxRows * 36 + tabBarH + 12
  return { w, h }
}

const BRAND_COLOR = '#7C3AED'

/** 表格内容渲染（单个 sheet） */
function SheetTable({
  sheet,
  onCellChange,
  isEditable = false,
}: {
  sheet: SheetData
  onCellChange?: (rowIdx: number, colIdx: number, value: string) => void
  isEditable?: boolean
}) {
  const colCount = Math.max(sheet.headers.length, 1)
  const [editCell, setEditCell] = useState<{ row: number; col: number } | null>(null)
  const [editValue, setEditValue] = useState('')

  const handleCellDoubleClick = (rowIdx: number, colIdx: number, value: string) => {
    if (!isEditable) return
    setEditCell({ row: rowIdx, col: colIdx })
    setEditValue(value)
  }

  const handleCellBlur = () => {
    if (editCell && onCellChange) {
      onCellChange(editCell.row, editCell.col, editValue)
    }
    setEditCell(null)
  }

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur()
    } else if (e.key === 'Escape') {
      setEditCell(null)
    }
  }

  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 12,
        tableLayout: 'fixed',
      }}
    >
      <thead>
        <tr>
          {sheet.headers.map((h, i) => (
            <th
              key={i}
              style={{
                padding: '8px 12px',
                background: `${BRAND_COLOR}10`,
                color: BRAND_COLOR,
                fontWeight: 600,
                textAlign: 'left',
                borderBottom: `2px solid ${BRAND_COLOR}20`,
                width: `${100 / colCount}%`,
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sheet.rows.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => {
              const isEditing = editCell?.row === ri && editCell?.col === ci
              return (
                <td
                  key={ci}
                  style={{
                    padding: 0,
                    color: '#374151',
                    borderBottom: '1px solid #F3F4F6',
                    background: isEditing ? '#FEF3C7' : ri % 2 === 1 ? '#FAFAFA' : 'transparent',
                    cursor: isEditable ? 'text' : 'default',
                  }}
                  onDoubleClick={() => handleCellDoubleClick(ri, ci, cell)}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleCellBlur}
                      onKeyDown={handleCellKeyDown}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '100%',
                        height: '100%',
                        padding: '7px 12px',
                        border: `1.5px solid ${BRAND_COLOR}`,
                        borderRadius: 4,
                        fontSize: 12,
                        fontFamily: 'inherit',
                        outline: 'none',
                      }}
                    />
                  ) : (
                    <div style={{ padding: '7px 12px', minHeight: '24px', display: 'flex', alignItems: 'center' }}>
                      {cell}
                    </div>
                  )}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** 标签页栏 */
function TabBar({ sheets, activeIndex, onSelect }: {
  sheets: SheetData[]
  activeIndex: number
  onSelect: (i: number) => void
}) {
  if (sheets.length <= 1) return null
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        borderTop: '1px solid #E5E7EB',
        background: '#F9FAFB',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {sheets.map((sheet, i) => {
        const isActive = i === activeIndex
        return (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(i)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? BRAND_COLOR : '#6B7280',
              background: isActive ? '#FFFFFF' : 'transparent',
              border: 'none',
              borderTop: isActive ? `2px solid ${BRAND_COLOR}` : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
              marginTop: -1,
            }}
          >
            {sheet.name}
          </button>
        )
      })}
    </div>
  )
}

export class TableCardShapeUtil extends ShapeUtil<any> {
  static override type = 'table-card' as const

  getDefaultProps() {
    return {
      w: 480,
      h: 200,
      title: '表格',
      headers: '[]',
      rows: '[]',
      sheets: '[]',
      sourceTaskId: '',
    }
  }

  getGeometry(shape: TableCardShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  override canResize = () => true
  override isAspectRatioLocked = () => false
  override hideRotateHandle = () => true

  override onResize = (shape: TableCardShape, info: any) => {
    return {
      props: {
        w: Math.max(300, shape.props.w * info.scaleX),
        h: Math.max(120, shape.props.h * info.scaleY),
      },
    }
  }

  override onBeforeCreate = (next: TableCardShape) => {
    const sheets = parseSheets(next.props)
    const { w, h } = computeSize(sheets)
    return { ...next, props: { ...next.props, w, h } }
  }

  component(shape: TableCardShape) {
    const sheets = parseSheets(shape.props)
    const [activeTab, setActiveTab] = useState(0)
    const [editedSheets, setEditedSheets] = useState(sheets)
    const [isEditing, setIsEditing] = useState(false)
    const currentSheet = editedSheets[activeTab] || editedSheets[0]

    const handleCellChange = useCallback((rowIdx: number, colIdx: number, value: string) => {
      setEditedSheets(prev => {
        const newSheets = JSON.parse(JSON.stringify(prev))
        if (newSheets[activeTab]?.rows[rowIdx]) {
          newSheets[activeTab].rows[rowIdx][colIdx] = value
        }
        return newSheets
      })
    }, [activeTab])

    const handleSaveChanges = useCallback(() => {
      const editor = (window as any).__tldrawEditor
      if (editor && shape.id) {
        // 更新 shape 的 sheets 属性
        editor.updateShape({
          id: shape.id,
          type: 'table-card',
          props: {
            sheets: JSON.stringify(editedSheets),
          },
        })
        setIsEditing(false)
      }
    }, [editedSheets, shape.id])

    if (!currentSheet) {
      return (
        <HTMLContainer id={shape.id} style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'all' }}>
          <div style={{ width: '100%', height: '100%', background: '#FFFFFF', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>
            空表格
          </div>
        </HTMLContainer>
      )
    }

    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: 'all',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            background: '#FFFFFF',
            borderRadius: 12,
            boxShadow: '0 2px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
            overflow: 'hidden',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            display: 'flex',
            flexDirection: 'column',
            border: isEditing ? `2px solid ${BRAND_COLOR}` : 'none',
          }}
        >
          {/* 标题栏 + 编辑按钮 */}
          <div
            style={{
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: 600,
              color: '#111827',
              borderBottom: '1px solid #F3F4F6',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: BRAND_COLOR, flexShrink: 0,
              }} />
              {shape.props.title}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {isEditing && (
                <>
                  <button
                    onClick={handleSaveChanges}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      background: BRAND_COLOR,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    ✓ 保存
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      background: '#E5E7EB',
                      color: '#6B7280',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    ✕ 取消
                  </button>
                </>
              )}
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    background: '#F3F4F6',
                    color: '#6B7280',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  ✎ 编辑
                </button>
              )}
            </div>
          </div>

          {/* 表格区域 */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <SheetTable
              sheet={currentSheet}
              isEditable={isEditing}
              onCellChange={handleCellChange}
            />
          </div>

          {/* 底部标签栏 */}
          <TabBar
            sheets={editedSheets}
            activeIndex={activeTab}
            onSelect={setActiveTab}
          />
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: TableCardShape) {
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        rx={12}
        ry={12}
        fill="none"
      />
    )
  }
}
