import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const COMPANY = {
  name: 'ET-König GmbH',
  fullName: 'ET-König GmbH',
  street: 'Lindbergstraße 5',
  city: 'A-8811 Scheifling',
  email: 'info@et-koenig.at',
  phone: '+43 664 53 19 079',
  web: 'www.et-koenig.at',
  iban1: 'AT74 2081 5166 0001 4555',
  bic1: 'STSPAT2GXXX',
  bank1: 'Steiermärkische Bank und Sparkassen AG',
  iban2: 'AT11 3840 2000 0204 4063',
  bic2: 'RZSTAT2G402',
  bank2: 'Raiffeisenbank Neumarkt-Oberwölz',
  fn: 'FN 405094 b – Gerichtsstand: Leoben',
  uid: 'ATU 682 87 445',
  gf: 'Harald KÖNIG',
}

const ORANGE = [246, 135, 20]   // #f68714
const DARK = [40, 40, 40]
const GRAY = [110, 110, 110]
const LIGHT_GRAY = [180, 180, 180]

const ML = 18
const MR = 18
const MT = 12

async function loadLogo() {
  try {
    const res = await fetch('/logo-etk.png')
    const blob = await res.blob()
    return new Promise(resolve => {
      const r = new FileReader()
      r.onloadend = () => resolve(r.result)
      r.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function fmt(val) {
  return Number(val || 0).toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtMenge(val) {
  return Number(val || 0).toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export async function generatePvAngebotPdf(offer) {
  const logo = await loadLogo()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth() // 210
  const pageH = doc.internal.pageSize.getHeight() // 297

  // ─── Seite 1: Header zeichnen ─────────────────────────────
  drawHeader(doc, logo, true)
  drawFooter(doc, 1)

  let y = 60

  // ─── Kunden-Block links ───────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...DARK)
  const anrede = offer.anrede || 'Herr'
  doc.text(anrede, ML, y); y += 5
  const fullName = offer.firma || `${offer.vorname || ''} ${offer.nachname || ''}`.trim() || '–'
  doc.text(fullName, ML, y); y += 5
  if (offer.strasse) { doc.text(offer.strasse, ML, y); y += 5 }
  if (offer.plz || offer.ort) { doc.text(`${offer.plz || ''} ${offer.ort || ''}`.trim(), ML, y); y += 5 }

  // ─── Beleg-Nr / Datum / Kd-Nr Box rechts ──────────────────
  const boxX = pageW - MR - 78
  const boxY = 64
  const boxW = 78
  const boxH = 18

  // Box Header
  doc.setDrawColor(...DARK)
  doc.setLineWidth(0.3)
  doc.rect(boxX, boxY, boxW, 8)
  doc.rect(boxX, boxY + 8, boxW, 10)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Beleg-Nr.', boxX + 13, boxY + 5.5, { align: 'center' })
  doc.text('Datum', boxX + 39, boxY + 5.5, { align: 'center' })
  doc.text('Kd-Nr.', boxX + 65, boxY + 5.5, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(offer.beleg_nr || '–', boxX + 13, boxY + 14, { align: 'center' })
  doc.text(formatDate(offer.datum), boxX + 39, boxY + 14, { align: 'center' })
  doc.text(offer.kd_nr || '–', boxX + 65, boxY + 14, { align: 'center' })

  // Vertikale Trennlinien in der Box
  doc.line(boxX + 26, boxY, boxX + 26, boxY + 18)
  doc.line(boxX + 52, boxY, boxX + 52, boxY + 18)

  // ─── Angebot Nr Titel + UID ───────────────────────────────
  y = 100
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...DARK)
  doc.text(`Angebot Nr.: ${offer.beleg_nr || '–'}`, ML, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(`UID-Nr. des Leistungsempfängers lt. RLG:${offer.uid_nummer ? ' ' + offer.uid_nummer : ''}`, ML, y)
  y += 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Materialangebot', ML, y)
  y += 8

  // ─── Positionstabelle ─────────────────────────────────────
  const gruppen = offer.positionen || []
  const tableBody = []

  let groupIdx = 1
  for (const gruppe of gruppen) {
    const grpNr = String(groupIdx).padStart(2, '0')
    // Group header row
    tableBody.push([
      { content: grpNr, styles: { fontStyle: 'bold' } },
      '', '',
      { content: gruppe.name || `Gruppe ${groupIdx}`, styles: { fontStyle: 'bold' } },
      '', '',
    ])

    let posIdx = 1
    for (const pos of (gruppe.positionen || [])) {
      const posNr = `${grpNr}.${String(posIdx).padStart(3, '0')}`
      const menge = `${fmtMenge(pos.menge)}`
      const einheit = pos.einheit || 'Stk'
      const preis = pos.preis_einzeln_zeigen === false ? '' : fmt(pos.preis)
      const gesamt = pos.preis_einzeln_zeigen === false ? '' : fmt((pos.menge || 0) * (pos.preis || 0))

      // Beschreibung kann mehrzeilig sein
      const desc = pos.modell ? `${pos.name}\n${pos.modell}` : pos.name
      tableBody.push([posNr, menge, einheit, desc, preis, gesamt])
      posIdx++
    }

    // Group total row
    const groupSum = (gruppe.positionen || []).reduce((s, p) => s + (Number(p.menge) || 0) * (Number(p.preis) || 0), 0)
    tableBody.push([
      { content: grpNr, styles: { fontStyle: 'bold' } },
      '', '',
      { content: `Summe: ${gruppe.name}`, styles: { fontStyle: 'bold' } },
      '',
      { content: fmt(groupSum), styles: { fontStyle: 'bold', halign: 'right' } },
    ])

    groupIdx++
  }

  autoTable(doc, {
    startY: y,
    head: [[
      { content: 'Pos.Nr.', styles: { halign: 'left' } },
      { content: 'Menge', styles: { halign: 'right' } },
      { content: 'Einh.', styles: { halign: 'left' } },
      { content: 'Beschreibung', styles: { halign: 'left' } },
      { content: 'Preis', styles: { halign: 'right' } },
      { content: 'Gesamt', styles: { halign: 'right' } },
    ]],
    body: tableBody,
    columnStyles: {
      0: { cellWidth: 17, halign: 'left' },
      1: { cellWidth: 17, halign: 'right' },
      2: { cellWidth: 13, halign: 'left' },
      3: { cellWidth: 'auto', halign: 'left' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 22, halign: 'right' },
    },
    margin: { left: ML, right: MR, top: 50, bottom: 30 },
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 },
      overflow: 'linebreak',
      textColor: DARK,
      lineWidth: 0,
    },
    headStyles: {
      fillColor: false,
      textColor: DARK,
      fontStyle: 'bold',
      fontSize: 8.5,
      lineWidth: { bottom: 0.3 },
      lineColor: DARK,
    },
    bodyStyles: {
      lineColor: [240, 240, 240],
      lineWidth: { bottom: 0.1 },
    },
    didDrawPage: (data) => {
      const pageNum = doc.internal.getCurrentPageInfo().pageNum
      if (pageNum > 1) {
        drawPageHeader(doc, offer)
        drawFooter(doc, pageNum)
      }
    },
  })

  let finalY = doc.lastAutoTable.finalY + 8

  // ─── Gruppenzusammenstellung ──────────────────────────────
  if (finalY > pageH - 80) {
    doc.addPage()
    drawPageHeader(doc, offer)
    drawFooter(doc, doc.internal.getCurrentPageInfo().pageNum)
    finalY = 50
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...DARK)
  doc.text('G R U P P E N Z U S A M M E N S T E L L U N G', ML, finalY)
  finalY += 6

  // Group summary rows
  groupIdx = 1
  for (const gruppe of gruppen) {
    const grpNr = String(groupIdx).padStart(2, '0')
    const groupSum = (gruppe.positionen || []).reduce((s, p) => s + (Number(p.menge) || 0) * (Number(p.preis) || 0), 0)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.text(grpNr, ML, finalY)
    doc.text(gruppe.name || '', ML + 12, finalY)
    doc.text(fmt(groupSum), pageW - MR, finalY, { align: 'right' })
    finalY += 5
    groupIdx++
  }

  finalY += 1
  // Trennlinie
  doc.setDrawColor(...DARK)
  doc.setLineWidth(0.3)
  doc.line(ML, finalY, pageW - MR, finalY)
  finalY += 4

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text('Nettobetrag', ML + 12, finalY)
  doc.text('[EUR]', pageW - MR - 28, finalY, { align: 'right' })
  doc.text(fmt(offer.netto), pageW - MR, finalY, { align: 'right' })
  finalY += 5

  doc.text('Mwst 20,00 %', ML + 12, finalY)
  doc.text('[EUR]', pageW - MR - 28, finalY, { align: 'right' })
  doc.text(fmt(offer.mwst), pageW - MR, finalY, { align: 'right' })
  finalY += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Bruttobetrag', ML + 12, finalY)
  doc.text('[EUR]', pageW - MR - 28, finalY, { align: 'right' })
  doc.text(fmt(offer.brutto), pageW - MR, finalY, { align: 'right' })
  finalY += 12

  // ─── Schlusstext ─────────────────────────────────────────
  if (finalY > pageH - 60) {
    doc.addPage()
    drawPageHeader(doc, offer)
    drawFooter(doc, doc.internal.getCurrentPageInfo().pageNum)
    finalY = 50
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text('Wir hoffen, dass unser Angebot Ihren Vorstellungen entspricht und würden uns über', ML, finalY); finalY += 4.5
  doc.text('eine Auftragserteilung Ihrerseits sehr freuen.', ML, finalY); finalY += 8
  doc.text('Der Angebotspreis ist 60 Tage gültig.', ML, finalY)

  // Re-draw all footers with correct total page numbers
  const total = doc.internal.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    drawFooter(doc, i, total)
  }

  return doc.output('blob')
}

function drawHeader(doc, logo, isFirstPage) {
  const pageW = doc.internal.pageSize.getWidth()
  if (logo) {
    try {
      // Logo links oben (mit Platz für die Schleife)
      doc.addImage(logo, 'PNG', ML, MT, 65, 24)
    } catch {}
  }

  // Slogan + Branchen rechts oben
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.setTextColor(...DARK)
  doc.text('Elektroinstallation • Photovoltaik • Blitzschutz • Alarmanlagen •', pageW - MR, MT + 4, { align: 'right' })
  doc.text('Sat-Anlagen • KNX/EIB • Gas – Wasser – Heizung', pageW - MR, MT + 8, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...ORANGE)
  doc.text('EINEN ', pageW - MR - 35, MT + 16)
  doc.setTextColor(...ORANGE)
  doc.text('HERZSCHLAG', pageW - MR - 21, MT + 16)
  doc.setTextColor(...DARK)
  doc.text(' VORAUS', pageW - MR, MT + 16, { align: 'right' })
}

function drawPageHeader(doc, offer) {
  const pageW = doc.internal.pageSize.getWidth()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...DARK)
  const fullName = offer.firma || `${offer.vorname || ''} ${offer.nachname || ''}`.trim()
  const text = `Angebot Nr. ${offer.beleg_nr || ''} vom: ${formatDate(offer.datum)} für ${offer.anrede || ''} ${fullName}`
  doc.text(text, ML, 18)
  const pageNum = doc.internal.getCurrentPageInfo().pageNum
  doc.setFont('helvetica', 'normal')
  doc.text(`Seite: ${pageNum}`, pageW - MR, 18, { align: 'right' })
  doc.setDrawColor(...DARK)
  doc.setLineWidth(0.3)
  doc.line(ML, 22, pageW - MR, 22)
}

function drawFooter(doc, pageNum, totalPages) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const fy = pageH - 18

  // Trennlinie
  doc.setDrawColor(...LIGHT_GRAY)
  doc.setLineWidth(0.2)
  doc.line(ML, fy - 4, pageW - MR, fy - 4)

  // Eigentumsvorbehalt
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.text('Eigentumsvorbehalt: Die angeführten Lieferungen und Leistungen gehen erst nach vollständiger Bezahlung in das Eigentum des Auftraggebers über.', pageW / 2, fy - 1, { align: 'center' })

  // Linke Spalte - Firma
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...DARK)
  doc.text('ET-König GmbH,', ML, fy + 3.5)
  doc.setFont('helvetica', 'normal')
  doc.text(' Lindbergstraße 5, A-8811 Scheifling', ML + 17, fy + 3.5)

  doc.setFont('helvetica', 'bold')
  doc.text('T:', ML, fy + 7)
  doc.setFont('helvetica', 'normal')
  doc.text(' +43 664 53 19 079  |  ', ML + 3, fy + 7)
  doc.setFont('helvetica', 'bold')
  doc.text('E:', ML + 36, fy + 7)
  doc.setFont('helvetica', 'normal')
  doc.text(' info@et-koenig.at', ML + 39, fy + 7)

  doc.setFont('helvetica', 'bold')
  doc.text('www.et-koenig.at', ML, fy + 10.5)

  // Rechte Spalte - Bank
  const rx = pageW - MR
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...DARK)
  doc.text('Steiermärkische Bank und Sparkassen AG: IBAN: AT74 2081 5166 0001 4555  |  BIC: STSPAT2GXXX', rx, fy + 3.5, { align: 'right' })
  doc.text('Raiffeisenbank Neumarkt-Oberwölz: IBAN: AT11 3840 2000 0204 4063  |  BIC: RZSTAT2G402', rx, fy + 7, { align: 'right' })
  doc.text('FN 405094 b – Gerichtsstand: Leoben  |  UID-Nr.: ATU 682 87 445', rx, fy + 10.5, { align: 'right' })
}

function formatDate(d) {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
