import fs from 'node:fs'
import path from 'node:path'
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx'
import * as XLSX from 'xlsx'

type HeadingState = Array<{ level: number; text: string }>

type MarkdownTable = {
  title: string
  rows: string[][]
}

function readFile(filePath: string) {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n')
}

function isTableLine(line: string) {
  return /^\|.*\|$/.test(line.trim())
}

function isTableSeparator(line: string) {
  return /^\|\s*:?[-\s|:]+\|$/.test(line.trim())
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function parseMarkdownTables(markdown: string): MarkdownTable[] {
  const lines = markdown.split('\n')
  const headings: HeadingState = []
  const tables: MarkdownTable[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line.trim())
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2].trim()
      while (headings.length && headings[headings.length - 1].level >= level) headings.pop()
      headings.push({ level, text })
      continue
    }

    if (!isTableLine(line)) continue

    const headerLine = lines[i]
    const separatorLine = lines[i + 1] || ''
    if (!isTableSeparator(separatorLine)) continue

    const rows: string[][] = [splitTableRow(headerLine)]
    i += 2
    while (i < lines.length && isTableLine(lines[i])) {
      rows.push(splitTableRow(lines[i]))
      i += 1
    }
    i -= 1

    tables.push({
      title: headings.map((item) => item.text).join(' - ') || `Table ${tables.length + 1}`,
      rows,
    })
  }

  return tables
}

function pushParagraphSection(children: Array<Paragraph | Table>, line: string) {
  const trimmed = line.trim()
  if (!trimmed) return

  const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed)
  if (headingMatch) {
    const level = Math.min(headingMatch[1].length, 3)
    const text = headingMatch[2].trim()
    children.push(
      new Paragraph({
        heading: level === 1 ? 'Heading1' : level === 2 ? 'Heading2' : 'Heading3',
        children: [new TextRun(text)],
        spacing: { before: 240, after: 120 },
      })
    )
    return
  }

  if (/^- /.test(trimmed)) {
    children.push(
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun(trimmed.replace(/^- /, ''))],
      })
    )
    return
  }

  children.push(
    new Paragraph({
      children: [new TextRun(trimmed)],
      spacing: { after: 120 },
    })
  )
}

function parseMarkdownToDocxChildren(markdown: string) {
  const children: Array<Paragraph | Table> = []
  const lines = markdown.split('\n')

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!isTableLine(line)) {
      pushParagraphSection(children, line)
      continue
    }

    const headerLine = lines[i]
    const separatorLine = lines[i + 1] || ''
    if (!isTableSeparator(separatorLine)) {
      pushParagraphSection(children, line)
      continue
    }

    const rows: string[][] = [splitTableRow(headerLine)]
    i += 2
    while (i < lines.length && isTableLine(lines[i])) {
      rows.push(splitTableRow(lines[i]))
      i += 1
    }
    i -= 1

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: rows.map((row, rowIndex) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: cell,
                          bold: rowIndex === 0,
                        }),
                      ],
                    }),
                  ],
                })
            ),
          })
        ),
      })
    )
  }

  return children
}

function sanitizeSheetName(value: string, index: number) {
  const normalized = value
    .replace(/[\\/?*[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const base = normalized || `Sheet ${index + 1}`
  return base.length > 31 ? base.slice(0, 31) : base
}

function buildUniqueSheetName(raw: string, index: number, used: Set<string>) {
  const base = sanitizeSheetName(raw, index)
  if (!used.has(base)) {
    used.add(base)
    return base
  }

  let counter = 2
  while (counter < 1000) {
    const suffix = ` ${counter}`
    const candidate = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`
    if (!used.has(candidate)) {
      used.add(candidate)
      return candidate
    }
    counter += 1
  }

  const fallback = `Sheet ${index + 1}`
  used.add(fallback)
  return fallback
}

async function exportLayer1Docx(inputPath: string, outputPath: string) {
  const markdown = readFile(inputPath)
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: parseMarkdownToDocxChildren(markdown),
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(outputPath, buffer)
}

function exportLayer2Xlsx(inputPath: string, outputPath: string) {
  const markdown = readFile(inputPath)
  const tables = parseMarkdownTables(markdown)
  const workbook = XLSX.utils.book_new()
  const usedSheetNames = new Set<string>()
  const sheetNames = tables.map((table, index) => buildUniqueSheetName(table.title, index, usedSheetNames))

  const overviewData = [
    ['Tài liệu', path.basename(inputPath)],
    ['Số bảng', String(tables.length)],
    [],
    ['STT', 'Tên sheet', 'Nguồn tiêu đề'],
    ...tables.map((table, index) => [String(index + 1), sheetNames[index], table.title]),
  ]
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(overviewData), 'Tong quan')

  tables.forEach((table, index) => {
    const sheetName = sheetNames[index]
    const sheet = XLSX.utils.aoa_to_sheet([
      [table.title],
      [],
      ...table.rows,
    ])
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
  })

  XLSX.writeFile(workbook, outputPath)
}

async function main() {
  const cwd = process.cwd()
  const outputDir = path.join(cwd, 'docs', 'exports')
  fs.mkdirSync(outputDir, { recursive: true })

  const layer1Input = path.join(cwd, 'docs', 'V2_BUSINESS_PROCESS_LAYER_1.md')
  const layer2Input = path.join(cwd, 'docs', 'V2_BUSINESS_PROCESS_LAYER_2_RACI.md')
  const layer1Output = path.join(outputDir, 'V2_BUSINESS_PROCESS_LAYER_1.docx')
  const layer2Output = path.join(outputDir, 'V2_BUSINESS_PROCESS_LAYER_2_RACI.xlsx')

  await exportLayer1Docx(layer1Input, layer1Output)
  exportLayer2Xlsx(layer2Input, layer2Output)

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        outputs: {
          layer1Docx: layer1Output,
          layer2Xlsx: layer2Output,
        },
      },
      null,
      2
    )
  )
}

void main()
