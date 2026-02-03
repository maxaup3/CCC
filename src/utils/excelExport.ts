/**
 * Excel 导出工具
 * 使用 SheetJS 将产品卡片数据导出为 .xlsx 文件
 */
import * as XLSX from 'xlsx'

interface ProductData {
  name: string
  tagline: string
  tags: string[]
  detail: string
  sources: Array<{ title: string; domain: string; url: string }>
}

export async function exportToXLSX(
  products: ProductData[],
  title: string = '画布产品数据'
): Promise<Blob> {
  const header = ['名称', '描述', '标签', '详细分析', '来源']

  const rows = products.map(p => [
    p.name,
    p.tagline,
    p.tags.join(', '),
    p.detail,
    p.sources.map(s => `${s.title} (${s.url})`).join('\n'),
  ])

  const data = [header, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(data)

  // 设置列宽
  ws['!cols'] = [
    { wch: 20 },  // A: 名称
    { wch: 30 },  // B: 描述
    { wch: 20 },  // C: 标签
    { wch: 60 },  // D: 详细分析
    { wch: 40 },  // E: 来源
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31)) // sheet name max 31 chars

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
