import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Unternehmensinfos ────────────────────────────────────────────────────────
const COMPANY = {
  name: 'epower GmbH',
  brand: 'epower GmbH',
  street: 'Frojacher Straße 5',
  city: '8841 Frojach',
  plz: '8841 Frojach',
  gf: 'Christoph Napetschnig',
  steuernr: '',
  uid: '',
  iban: '',
  bic: '',
  bank: '',
  mobil: '',
  email: 'hallo@epowergmbh.at',
}

const COLOR_PRIMARY = [58, 58, 58]    // #3a3a3a
const COLOR_DARK    = [26, 26, 26]    // #1a1a1a
const COLOR_GRAY    = [120, 120, 120]
const COLOR_LIGHT   = [240, 240, 240]
const COLOR_WHITE   = [255, 255, 255]
const COLOR_BLACK   = [0, 0, 0]

// Hero-Layout Ränder (mm) – exakt wie Hero-Software
const ML = 15        // links (gemessen aus Referenz-PDF)
const MR = 15        // rechts
const MT = 8         // oben (Logo-Oberkante, weiter oben)
const MB = 28        // unten (Platz für Footer)
const FONT_BODY = 9
const FONT_SMALL = 8
const FONT_FOOTER = 7
const LINE_H = 4.2   // Zeilenabstand normal

// Logo-Dimensionen (2048x2048px → Ratio 1:1, quadratisch)
const LOGO_W = 38
const LOGO_H = 38

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────
function fmt(val) {
  return Number(val || 0).toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtEur(val) {
  return fmt(val) + ' €'
}
// Menge: ganze Zahlen ohne Dezimalen (wie Hero: "1 pauschal", nicht "1,00 pauschal")
function fmtMenge(val) {
  const n = Number(val || 0)
  if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 0.001) return String(Math.round(n))
  return n.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function loadLogoBase64() {
  try {
    const res = await fetch('/logo-epower.png')
    const blob = await res.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ANGEBOT PDF – exakt wie Hero Handwerkersoftware
// ══════════════════════════════════════════════════════════════════════════════

export async function generateAngebotPdf({
  betrifft, adresse, projektnummer,
  gewerke = [], netto = 0, mwst = 0, brutto = 0,
  ergaenzungen = [],
  hinweise = [],
  userName, userEmail,
  datum,
  empfaenger,
}) {
  const logo = await loadLogoBase64()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()   // 210
  const pageH = doc.internal.pageSize.getHeight()  // 297
  const contentW = pageW - ML - MR                 // 180

  const ctx = { logo, projektnummer, datum, userName, empfaenger, adresse }

  // ── Seite 1: Header ──
  drawAngebotHeader(doc, ctx, true)

  let y = 80 // Start nach Header-Block + Kundenadresse (genug Abstand)

  // ── Angebots-Titel (fett, 11pt) ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COLOR_BLACK)
  const titleText = `Angebot: ${betrifft || 'Installationsarbeiten'}`
  const titleLines = doc.splitTextToSize(titleText, contentW)
  doc.text(titleLines, ML, y)
  y += titleLines.length * 5 + 3

  // ── Anrede ──
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(FONT_BODY)
  doc.text('Sehr geehrte Damen und Herren,', ML, y)
  y += LINE_H * 2

  // ── Einleitungstext ──
  const intro = 'vielen Dank für Ihre Anfrage und Ihr Interesse an unseren Leistungen. Gerne übermitteln wir Ihnen unser Angebot und hoffen, dass es Ihren Vorstellungen entspricht.'
  const introLines = doc.splitTextToSize(intro, contentW)
  doc.text(introLines, ML, y, { align: 'justify', maxWidth: contentW })
  y += introLines.length * LINE_H + 4

  // ── Ergänzungen (nach Einleitungstext, vor Tabelle) ──
  const activeErg = (ergaenzungen || []).filter(e => typeof e === 'string' ? e.trim() : e?.text)
  if (activeErg.length > 0) {
    if (y + 15 > pageH - MB) { doc.addPage(); drawAngebotHeader(doc, ctx, false); y = MT + 8 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(FONT_BODY)
    doc.setTextColor(...COLOR_BLACK)
    doc.text('Ergänzungen:', ML, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    for (const e of activeErg) {
      const txt = typeof e === 'string' ? e : e.text
      const lines = doc.splitTextToSize(`• ${txt}`, contentW - 4)
      if (y + lines.length * LINE_H > pageH - MB) { doc.addPage(); drawAngebotHeader(doc, ctx, false); y = MT + 8 }
      doc.text(lines, ML + 2, y)
      y += lines.length * LINE_H + 1
    }
    y += 3
  }

  // ── Hinweise (nach Ergänzungen, vor Tabelle) ──
  const activeHinweise = (hinweise || []).filter(h => typeof h === 'string' ? h.trim() : h?.text)
  if (activeHinweise.length > 0) {
    if (y + 15 > pageH - MB) { doc.addPage(); drawAngebotHeader(doc, ctx, false); y = MT + 8 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(FONT_BODY)
    doc.setTextColor(...COLOR_BLACK)
    doc.text('Hinweise:', ML, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    for (const h of activeHinweise) {
      const txt = typeof h === 'string' ? h : h.text
      const lines = doc.splitTextToSize(`• ${txt}`, contentW - 4)
      if (y + lines.length * LINE_H > pageH - MB) { doc.addPage(); drawAngebotHeader(doc, ctx, false); y = MT + 8 }
      doc.text(lines, ML + 2, y)
      y += lines.length * LINE_H + 1
    }
    y += 3
  }

  // ── Positionstabelle ──
  const allPositions = []
  let posIdx = 1
  for (const gewerk of gewerke) {
    for (const pos of (gewerk.positionen || [])) {
      allPositions.push({ ...pos, _posNr: String(posIdx).padStart(3, '0'), _gewerk: gewerk.name })
      posIdx++
    }
  }

  const tableBody = allPositions.map(pos => {
    const kurztext = pos.leistungsname || pos.kurztext || ''
    const langtext = pos.beschreibung || pos.langtext || ''
    const mengeStr = `${fmtMenge(pos.menge)} ${pos.einheit || ''}`

    return [
      pos._posNr,
      mengeStr,
      { kurztext, langtext },
      fmtEur(pos.vk_netto_einheit),
      fmtEur(pos.gesamtpreis),
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [[
      { content: 'Pos', styles: { halign: 'center' } },
      { content: 'Menge', styles: { halign: 'left' } },
      'Bezeichnung',
      { content: 'Einheitspreis', styles: { halign: 'right' } },
      { content: 'Gesamt', styles: { halign: 'right' } },
    ]],
    body: tableBody,
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', valign: 'top', fontSize: FONT_BODY },
      1: { cellWidth: 20, halign: 'left', valign: 'top', fontSize: FONT_BODY },
      2: { cellWidth: 'auto', valign: 'top', fontSize: FONT_BODY },  // max. Breite für Bezeichnung
      3: { cellWidth: 22, halign: 'right', valign: 'top', fontSize: FONT_BODY },
      4: { cellWidth: 20, halign: 'right', valign: 'top', fontSize: FONT_BODY },
    },
    margin: { left: ML, right: MR, top: MT + 8, bottom: MB },
    styles: {
      fontSize: FONT_BODY,
      cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 },  // 30% weniger Abstand
      overflow: 'linebreak',
      textColor: COLOR_BLACK,
      lineColor: [200, 200, 200],
      lineWidth: 0,
    },
    headStyles: {
      fillColor: false,
      textColor: COLOR_BLACK,
      fontStyle: 'bold',
      fontSize: FONT_SMALL,  // 8pt damit "Einheitspreis" in die Spalte passt
      lineWidth: { bottom: 0.3, top: 0.3, left: 0, right: 0 },
      lineColor: COLOR_BLACK,
    },
    bodyStyles: {
      lineWidth: { bottom: 0.15, top: 0, left: 0, right: 0 },
      lineColor: [200, 200, 200],
    },
    alternateRowStyles: { fillColor: false },
    // Bezeichnung: kurztext bold + langtext normal (für Höhenberechnung)
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const cellData = data.cell.raw
        if (cellData && typeof cellData === 'object' && cellData.kurztext !== undefined) {
          const combined = [cellData.kurztext, cellData.langtext].filter(Boolean).join('\n')
          data.cell.text = combined ? combined.split('\n') : ['']
        }
      }
    },
    // Custom-Rendering: Kurztext fett, Langtext normal (Blocksatz)
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const cellData = data.cell.raw
        if (cellData && typeof cellData === 'object' && cellData.kurztext !== undefined) {
          const x = data.cell.x + 2
          let cellY = data.cell.y + 1.8 + FONT_BODY * 0.35
          const maxW = data.cell.width - 4

          // Default-Text löschen
          doc.setFillColor(255, 255, 255)
          doc.rect(data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 0.8, 'F')

          // Kurztext fett
          if (cellData.kurztext) {
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(FONT_BODY)
            doc.setTextColor(...COLOR_BLACK)
            const ktLines = doc.splitTextToSize(cellData.kurztext, maxW)
            doc.text(ktLines, x, cellY)
            cellY += ktLines.length * LINE_H + 0.3
          }

          // Langtext normal (Blocksatz wie Hero)
          if (cellData.langtext) {
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(FONT_BODY)
            doc.setTextColor(...COLOR_BLACK)
            const ltLines = doc.splitTextToSize(cellData.langtext, maxW)
            doc.text(ltLines, x, cellY, { align: 'justify', maxWidth: maxW })
          }
        }
      }
    },
    didDrawPage: () => {
      const pn = doc.internal.getCurrentPageInfo().pageNumber
      drawAngebotHeader(doc, ctx, pn === 1)
    },
    rowPageBreak: 'avoid',
  })

  y = (doc.lastAutoTable?.finalY || y) + 6

  // ── Summenblock (Hero-Style: volle Breite, Tabellenzeilen mit Borders) ──
  if (y + 25 > pageH - MB) { doc.addPage(); drawAngebotHeader(doc, ctx, false); y = MT + 8 }
  y += 4

  autoTable(doc, {
    startY: y,
    body: [
      [{ content: 'Nettobetrag', styles: { fontStyle: 'bold' } }, { content: fmtEur(netto), styles: { halign: 'right', fontStyle: 'bold' } }],
      [{ content: 'zzgl. 20% MwSt.' }, { content: fmtEur(mwst), styles: { halign: 'right' } }],
      [{ content: 'Gesamtsumme', styles: { fontStyle: 'bold' } }, { content: fmtEur(brutto), styles: { halign: 'right', fontStyle: 'bold' } }],
    ],
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 50, halign: 'right' },
    },
    margin: { left: ML, right: MR },
    styles: {
      fontSize: FONT_BODY,
      cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
      textColor: COLOR_BLACK,
    },
    theme: 'plain',
    didParseCell: (data) => {
      data.cell.styles.lineWidth = { top: 0.2, bottom: 0.2, left: 0, right: 0 }
      data.cell.styles.lineColor = COLOR_BLACK
    },
  })

  y = (doc.lastAutoTable?.finalY || y) + 10

  // ── Schlusstext (Seite 3 in der Hero-Vorlage) ──
  if (y + 50 > pageH - MB) { doc.addPage(); drawAngebotHeader(doc, ctx, false); y = MT + 8 }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(FONT_BODY)
  doc.setTextColor(...COLOR_BLACK)

  doc.text('Preise gültig für die Dauer von 3 Monaten.', ML, y)
  y += LINE_H * 2

  doc.text('Die Aufmaß Abrechnung erfolgt nach tatsächlichem Aufwand und ÖNORM.', ML, y)
  y += LINE_H * 2

  const schluss3 = 'Wir würden uns freuen, Ihr Projekt gemeinsam mit Ihnen umzusetzen und stehen Ihnen für Rückfragen jederzeit gerne zur Verfügung.'
  const s3Lines = doc.splitTextToSize(schluss3, contentW)
  doc.text(s3Lines, ML, y, { align: 'justify', maxWidth: contentW })
  y += s3Lines.length * LINE_H + 8

  doc.text('Mit freundlichen Grüßen', ML, y)
  y += LINE_H * 3

  doc.setFont('helvetica', 'bold')
  doc.text('Christoph Napetschnig', ML, y)
  y += LINE_H + 1
  doc.setFont('helvetica', 'normal')
  doc.text('Geschäftsführer / epower GmbH', ML, y)

  // ── Footer auf allen Seiten ──
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawAngebotFooter(doc, i, totalPages)
  }

  return doc.output('blob')
}

// ── Angebot Header – Professionelles Handwerker-Layout ───────────────────────
function drawAngebotHeader(doc, ctx, isFirstPage) {
  const pageW = doc.internal.pageSize.getWidth() // 210
  const { logo, projektnummer, datum, userName, adresse } = ctx

  if (!isFirstPage) return

  // ── Logo oben links (groß)
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', ML, MT, LOGO_W, LOGO_H)
    } catch { /* ignore */ }
  }

  // ── Rechte Spalte: Firmenname, Adresse, dann Angebotsdaten
  const rx = pageW - MR // rechter Rand
  const rlabel = pageW / 2 + 10 // Labels starten ab Seitenmitte + 10mm
  let ry = MT + 4

  // Firmenname
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COLOR_PRIMARY)
  doc.text(COMPANY.name, rx, ry, { align: 'right' })
  ry += 4.5

  // Firmenadresse
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...COLOR_GRAY)
  doc.text(COMPANY.street, rx, ry, { align: 'right' }); ry += 3.2
  doc.text(COMPANY.city, rx, ry, { align: 'right' }); ry += 3.2
  doc.text(COMPANY.email, rx, ry, { align: 'right' }); ry += 6

  // Datum
  doc.setFontSize(FONT_SMALL)
  doc.setTextColor(...COLOR_GRAY)
  doc.text('Datum:', rlabel, ry)
  doc.setTextColor(...COLOR_BLACK)
  doc.text(datum || '–', rx, ry, { align: 'right' }); ry += 3.8

  // Ansprechpartner
  doc.setTextColor(...COLOR_GRAY)
  doc.text('Ansprechpartner:', rlabel, ry)
  doc.setTextColor(...COLOR_BLACK)
  doc.text(userName || COMPANY.gf, rx, ry, { align: 'right' }); ry += 3.8

  // E-Mail
  doc.setTextColor(...COLOR_GRAY)
  doc.text('E-Mail:', rlabel, ry)
  doc.setTextColor(...COLOR_BLACK)
  doc.text(COMPANY.email, rx, ry, { align: 'right' })

  // ── Trennlinie knapp unter Logo
  const lineY = MT + LOGO_H + 1
  doc.setDrawColor(...COLOR_PRIMARY)
  doc.setLineWidth(0.5)
  doc.line(ML, lineY, pageW - MR, lineY)

  // ── Kundenanschrift links unter Trennlinie (Zeile für Zeile)
  let cy = lineY + 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...COLOR_GRAY)
  doc.text('An:', ML, cy)
  cy += 4

  if (projektnummer) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(FONT_BODY)
    doc.setTextColor(...COLOR_BLACK)
    doc.text(projektnummer, ML, cy)
    cy += 4.5
  }

  if (adresse) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(FONT_BODY)
    doc.setTextColor(...COLOR_DARK)
    // Adresse zeilenweise: Straße und PLZ/Ort getrennt
    // Versuche "Straße Nr, PLZ Ort" zu splitten
    const parts = adresse.split(/,\s*/)
    for (const part of parts) {
      doc.text(part.trim(), ML, cy)
      cy += 4.2
    }
  }
}

// ── Angebot Footer (Hero-Vorlage, OHNE Angebotsnummer links) ────────────────
function drawAngebotFooter(doc, pageNum, totalPages) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const fy = pageH - 20

  // Trennlinie
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.25)
  doc.line(ML, fy, pageW - MR, fy)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(FONT_FOOTER)
  doc.setTextColor(...COLOR_GRAY)

  // Mitte: Firmeninfos 3-zeilig (zentriert)
  const cx = pageW / 2
  doc.text(`${COMPANY.brand} ${COMPANY.name} | ${COMPANY.street} | ${COMPANY.city} | Geschäftsführer: ${COMPANY.gf}`, cx, fy + 5, { align: 'center' })
  doc.text(`${COMPANY.plz} | Steuernummer: ${COMPANY.steuernr} | USt-IdNr.: ${COMPANY.uid}`, cx, fy + 9, { align: 'center' })
  doc.text(`${COMPANY.bank} | IBAN: ${COMPANY.iban} | BIC: ${COMPANY.bic}`, cx, fy + 13, { align: 'center' })

  // Rechts: Seitenzahl
  doc.text(`Seite ${pageNum}/${totalPages}`, pageW - MR, fy + 5, { align: 'right' })
}


// ══════════════════════════════════════════════════════════════════════════════
// PROTOKOLL PDF (bestehend, unverändert)
// ══════════════════════════════════════════════════════════════════════════════

// Old-style header/footer for Protokoll (kept for backward compatibility)
function drawProtoHeader(doc, { logo, projektnummer, datum, userName, userEmail, adresse, isFirstPage }) {
  const pageW = doc.internal.pageSize.getWidth()

  doc.setFillColor(...COLOR_PRIMARY)
  doc.rect(0, 0, pageW, 3, 'F')

  if (logo) {
    try { doc.addImage(logo, 'PNG', pageW - 48, 5, 33, 21) } catch { /* ignore */ }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...COLOR_DARK)
  doc.text('epower GmbH', pageW - 15, 31, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...COLOR_GRAY)
  let ry = 36
  if (projektnummer) { doc.text(`Projekt-Nr.: ${projektnummer}`, pageW - 15, ry, { align: 'right' }); ry += 3.8 }
  doc.text(`Datum: ${datum}`, pageW - 15, ry, { align: 'right' }); ry += 3.8
  if (userName) { doc.text(`Ansprechpartner: ${userName}`, pageW - 15, ry, { align: 'right' }); ry += 3.8 }
  if (userEmail) { doc.text(userEmail, pageW - 15, ry, { align: 'right' }) }

  if (isFirstPage && adresse) {
    doc.setTextColor(...COLOR_DARK)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(adresse, 80)
    doc.text(lines, 15, 16)
  }

  doc.setDrawColor(...COLOR_PRIMARY)
  doc.setLineWidth(0.5)
  doc.line(15, 45, pageW - 15, 45)
}

function drawProtoFooter(doc, pageNum, totalPages) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const fy = pageH - 22

  doc.setDrawColor(...COLOR_GRAY)
  doc.setLineWidth(0.25)
  doc.line(15, fy, pageW - 15, fy)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...COLOR_GRAY)
  const cx = pageW / 2
  doc.text(`epower GmbH | ${COMPANY.city} | Geschäftsführer: ${COMPANY.gf}`, cx, fy + 5, { align: 'center' })
  doc.text(`Steuernummer: ${COMPANY.steuernr} | USt-IdNr.: ${COMPANY.uid}`, cx, fy + 10, { align: 'center' })
  doc.text(`${COMPANY.bank} | IBAN: ${COMPANY.iban} | BIC: ${COMPANY.bic}`, cx, fy + 15, { align: 'center' })
  doc.setFontSize(7)
  doc.text(`Seite ${pageNum}/${totalPages}`, pageW - 15, fy + 10, { align: 'right' })
}

export async function generateProtokollPdf({
  betrifft, adresse, projektnummer,
  protokoll = {},
  userName, userEmail,
  datum,
}) {
  const logo = await loadLogoBase64()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const contentW = pageW - 15 - 15
  const headerCtx = { logo, projektnummer, datum, userName, userEmail, adresse, isFirstPage: true }

  drawProtoHeader(doc, { ...headerCtx, isFirstPage: true })

  let y = 48

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...COLOR_DARK)
  const title = `Besprechungsprotokoll${betrifft ? ' – ' + betrifft : ''}`
  const titleLines = doc.splitTextToSize(title, contentW)
  doc.text(titleLines, 15, y)
  y += titleLines.length * 6 + 4

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...COLOR_GRAY)
  const metaParts = []
  if (datum) metaParts.push(`Datum: ${datum}`)
  if (projektnummer) metaParts.push(`Projekt-Nr.: ${projektnummer}`)
  if (adresse) metaParts.push(`Adresse: ${adresse}`)
  if (metaParts.length) { doc.text(metaParts.join('  |  '), 15, y); y += 7 }

  doc.setDrawColor(...COLOR_LIGHT)
  doc.setLineWidth(0.3)
  doc.line(15, y, pageW - 15, y)
  y += 6

  const punkte = protokoll.punkte || []
  for (const p of punkte) {
    const blockHeight = 6 + (p.beschreibung ? 5 : 0) + (p.massnahme ? 5 : 0) + (p.zustaendig ? 5 : 0) + 4
    if (y + blockHeight > doc.internal.pageSize.getHeight() - 28) {
      doc.addPage(); drawProtoHeader(doc, { ...headerCtx, isFirstPage: false }); y = 48
    }

    const zusatzBadge = p.ist_zusatzleistung ? ' [ZUSATZLEISTUNG]' : ''
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...COLOR_DARK)
    const themaText = `${p.nr}. ${p.thema || ''}${zusatzBadge}`
    if (p.ist_zusatzleistung) doc.setTextColor(192, 57, 43)
    const themaLines = doc.splitTextToSize(themaText, contentW)
    doc.text(themaLines, 15, y)
    y += themaLines.length * 5

    if (p.beschreibung) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(60, 60, 60)
      const descLines = doc.splitTextToSize(p.beschreibung, contentW - 4)
      if (y + descLines.length * 4.2 > doc.internal.pageSize.getHeight() - 28) {
        doc.addPage(); drawProtoHeader(doc, { ...headerCtx, isFirstPage: false }); y = 48
      }
      doc.text(descLines, 18, y); y += descLines.length * 4.2 + 1
    }

    if (p.massnahme) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.setTextColor(...COLOR_GRAY)
      const massLines = doc.splitTextToSize(`Maßnahme: ${p.massnahme}`, contentW - 4)
      if (y + massLines.length * 4 > doc.internal.pageSize.getHeight() - 28) {
        doc.addPage(); drawProtoHeader(doc, { ...headerCtx, isFirstPage: false }); y = 48
      }
      doc.text(massLines, 18, y); y += massLines.length * 4 + 1
    }

    if (p.zustaendig) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...COLOR_GRAY)
      doc.text(`Zuständig: ${p.zustaendig}`, 18, y); y += 4
    }

    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.2)
    doc.line(15, y + 2, pageW - 15, y + 2)
    y += 6
  }

  if (protokoll.zusammenfassung) {
    if (y + 20 > doc.internal.pageSize.getHeight() - 28) {
      doc.addPage(); drawProtoHeader(doc, { ...headerCtx, isFirstPage: false }); y = 48
    }
    y += 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...COLOR_DARK)
    doc.text('Zusammenfassung', 15, y); y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(60, 60, 60)
    const summLines = doc.splitTextToSize(protokoll.zusammenfassung, contentW)
    doc.text(summLines, 15, y); y += summLines.length * 4.5 + 5
  }

  if (protokoll.offene_punkte?.length > 0) {
    if (y + 15 > doc.internal.pageSize.getHeight() - 28) {
      doc.addPage(); drawProtoHeader(doc, { ...headerCtx, isFirstPage: false }); y = 48
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...COLOR_DARK)
    doc.text('Offene Punkte', 15, y); y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(60, 60, 60)
    for (const op of protokoll.offene_punkte) {
      const opLines = doc.splitTextToSize(`• ${op}`, contentW - 4)
      if (y + opLines.length * 4.2 > doc.internal.pageSize.getHeight() - 28) {
        doc.addPage(); drawProtoHeader(doc, { ...headerCtx, isFirstPage: false }); y = 48
      }
      doc.text(opLines, 17, y); y += opLines.length * 4.2
    }
  }

  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawProtoFooter(doc, i, totalPages)
  }

  return doc.output('blob')
}
