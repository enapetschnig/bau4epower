import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * PDF-Layout 1:1 zur ET KÖNIG Vorlage (siehe public/angebot-vorlage.pdf):
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ [LOGO]                          Branchen-Slogan rechts   │
 *   │                                 EINEN HERZSCHLAG VORAUS  │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ Anrede                          ┌────────────────────┐   │
 *   │ Vor- + Nachname                 │ Beleg-Nr | Datum…  │   │
 *   │ Strasse                         └────────────────────┘   │
 *   │ PLZ Ort                                                  │
 *   │                                                          │
 *   │ Angebot Nr.: 20230345                                    │
 *   │ UID-Nr. des Leistungsempfängers lt. RLG: …               │
 *   │ Materialangebot                                          │
 *   │ ──────────────────────────────────────────────────────── │
 *   │ Pos.Nr.  Menge Einh.  Beschreibung   Preis     Gesamt    │
 *   │ ──────────────────────────────────────────────────────── │
 *   │ 01                    PV Anlage 7,6kWp                   │
 *   │ 01.001    20,00 Stk   PV Modul …                         │
 *   │ …                                                        │
 *   │ 01                    Summe: PV Anlage 7,6kWp   8.750,00 │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ Footer: Eigentumsvorbehalt + Bank- und Firmen-Daten      │
 *   └──────────────────────────────────────────────────────────┘
 */

// ─── Konstanten ─────────────────────────────────────────────
const ORANGE = [246, 135, 20]   // #f68714 ET KÖNIG Orange
const DARK = [40, 40, 40]
const GRAY = [110, 110, 110]
const LIGHT_GRAY = [180, 180, 180]
const ROW_LINE = [225, 225, 225]

const ML = 18              // Margin links (mm)
const MR = 18              // Margin rechts
const MT = 12              // Margin oben
const FOOTER_TOP = 30      // Reservierter Footer-Bereich (mm vom unteren Rand)

// Logo-Originaldatei: 750×392 px → Aspect 1.913
// 60 × 31.4 mm hält das Verhältnis, ohne dass das Logo gestaucht wirkt.
const LOGO_W = 60
const LOGO_H = 31.4

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
function formatDate(d) {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ────────────────────────────────────────────────────────────
// Hauptfunktion
// ────────────────────────────────────────────────────────────
export async function generatePvAngebotPdf(offer) {
  const logo = await loadLogo()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()  // 210
  const pageH = doc.internal.pageSize.getHeight() // 297

  // ─ Seite 1: Briefkopf ─────────────────────────────────────
  drawLetterhead(doc, logo)

  // ─ Empfänger-Adresse links ────────────────────────────────
  let y = 58
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...DARK)

  doc.text(offer.anrede || 'Herr', ML, y); y += 5
  const fullName = offer.firma || `${offer.vorname || ''} ${offer.nachname || ''}`.trim() || '–'
  doc.text(fullName, ML, y); y += 5
  if (offer.strasse) { doc.text(offer.strasse, ML, y); y += 5 }
  if (offer.plz || offer.ort) {
    doc.text(`${offer.plz || ''} ${offer.ort || ''}`.trim(), ML, y); y += 5
  }

  // ─ Beleg-Nr / Datum / Kd-Nr Box rechts ───────────────────
  drawBelegBox(doc, offer, pageW)

  // ─ Angebot-Titel + UID + "Materialangebot" ───────────────
  let titleY = 100
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...DARK)
  doc.text(`Angebot Nr.: ${offer.beleg_nr || '–'}`, ML, titleY)
  titleY += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(`UID-Nr. des Leistungsempfängers lt. RLG:${offer.uid_nummer ? ' ' + offer.uid_nummer : ''}`, ML, titleY)
  titleY += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Materialangebot', ML, titleY)
  titleY += 6

  // ─ Positionstabelle ──────────────────────────────────────
  const gruppen = offer.positionen || []
  const tableBody = buildTableBody(gruppen)

  autoTable(doc, {
    startY: titleY,
    head: [[
      { content: 'Pos.Nr.',     styles: { halign: 'left'  } },
      { content: 'Menge',       styles: { halign: 'right' } },
      { content: 'Einh.',       styles: { halign: 'left'  } },
      { content: 'Beschreibung',styles: { halign: 'left'  } },
      { content: 'Preis',       styles: { halign: 'right' } },
      { content: 'Gesamt',      styles: { halign: 'right' } },
    ]],
    body: tableBody,
    columnStyles: {
      0: { cellWidth: 17, halign: 'left'  },  // Pos.Nr.
      1: { cellWidth: 16, halign: 'right' },  // Menge
      2: { cellWidth: 9,  halign: 'left'  },  // Einh.
      3: { cellWidth: 'auto', halign: 'left' },  // Beschreibung (~88 mm)
      4: { cellWidth: 22, halign: 'right' },  // Preis
      5: { cellWidth: 22, halign: 'right' },  // Gesamt
    },
    margin: { left: ML, right: MR, top: 30, bottom: FOOTER_TOP },
    styles: {
      fontSize: 9,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 },
      overflow: 'linebreak',
      textColor: DARK,
      lineWidth: 0,
      valign: 'top',
    },
    headStyles: {
      fillColor: false,
      textColor: DARK,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: { top: 2.6, bottom: 2.6, left: 2, right: 2 },
      lineWidth: { top: 0.4, bottom: 0.4 },
      lineColor: DARK,
    },
    bodyStyles: {
      lineWidth: { bottom: 0.1 },
      lineColor: ROW_LINE,
    },
    didDrawPage: () => {
      const pageNum = doc.internal.getCurrentPageInfo().pageNum
      if (pageNum > 1) drawPageHeader(doc, offer)
      drawFooter(doc)
    },
  })

  let finalY = doc.lastAutoTable.finalY + 10

  // ─ Gruppenzusammenstellung + Summen ───────────────────────
  if (finalY > pageH - FOOTER_TOP - 60) {
    doc.addPage()
    drawPageHeader(doc, offer)
    drawFooter(doc)
    finalY = 32
  }
  finalY = drawGruppenzusammenstellung(doc, offer, gruppen, finalY, pageW)

  // ─ Schlusstext ────────────────────────────────────────────
  finalY += 10
  if (finalY > pageH - FOOTER_TOP - 30) {
    doc.addPage()
    drawPageHeader(doc, offer)
    drawFooter(doc)
    finalY = 32
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...DARK)
  doc.text('Wir hoffen, dass unser Angebot Ihren Vorstellungen entspricht und würden uns über', ML, finalY); finalY += 4.5
  doc.text('eine Auftragserteilung Ihrerseits sehr freuen.', ML, finalY); finalY += 8
  doc.text('Der Angebotspreis ist 60 Tage gültig.', ML, finalY)

  // ─ Footer Re-Draw (Pages-Total korrigieren) ──────────────
  const total = doc.internal.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    drawFooter(doc)
  }

  return doc.output('blob')
}

// ────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ────────────────────────────────────────────────────────────

function buildTableBody(gruppen) {
  const rows = []
  let groupIdx = 1

  for (const gruppe of gruppen) {
    const grpNr = String(groupIdx).padStart(2, '0')

    // Group-Header (Pos-Nr links + fetter Gruppen-Name)
    rows.push([
      { content: grpNr, styles: { fontStyle: 'bold', cellPadding: { top: 3.5, bottom: 1.2, left: 2, right: 2 } } },
      '', '',
      { content: gruppe.name || `Gruppe ${groupIdx}`, styles: { fontStyle: 'bold', cellPadding: { top: 3.5, bottom: 1.2, left: 2, right: 2 } } },
      '', '',
    ])

    let posIdx = 1
    for (const pos of (gruppe.positionen || [])) {
      const posNr = `${grpNr}.${String(posIdx).padStart(3, '0')}`
      const menge = fmtMenge(pos.menge)
      const einheit = pos.einheit || 'Stk'
      const desc = pos.modell ? `${pos.name}\n${pos.modell}` : (pos.name || '')
      const preis = pos.preis_einzeln_zeigen === false ? '' : fmt(pos.preis)
      const gesamt = pos.preis_einzeln_zeigen === false ? '' : fmt((pos.menge || 0) * (pos.preis || 0))

      rows.push([posNr, menge, einheit, desc, preis, gesamt])
      posIdx++
    }

    // Group-Total
    const groupSum = (gruppe.positionen || []).reduce(
      (s, p) => s + (Number(p.menge) || 0) * (Number(p.preis) || 0), 0)
    rows.push([
      { content: grpNr, styles: { fontStyle: 'bold', cellPadding: { top: 3.5, bottom: 1.5, left: 2, right: 2 } } },
      '', '',
      { content: `Summe: ${gruppe.name}`, styles: { fontStyle: 'bold', cellPadding: { top: 3.5, bottom: 1.5, left: 2, right: 2 } } },
      '',
      { content: fmt(groupSum), styles: { fontStyle: 'bold', halign: 'right', cellPadding: { top: 3.5, bottom: 1.5, left: 2, right: 2 } } },
    ])

    groupIdx++
  }
  return rows
}

function drawLetterhead(doc, logo) {
  const pageW = doc.internal.pageSize.getWidth()

  if (logo) {
    try {
      doc.addImage(logo, 'PNG', ML, MT, LOGO_W, LOGO_H, undefined, 'FAST')
    } catch { /* logo egal, weiter */ }
  }

  // Branchen-Slogan rechts (kursiv, 8.5pt)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.setTextColor(...DARK)
  doc.text('Elektroinstallation • Photovoltaik • Blitzschutz • Alarmanlagen •', pageW - MR, MT + 5, { align: 'right' })
  doc.text('Sat-Anlagen • KNX/EIB • Gas – Wasser – Heizung', pageW - MR, MT + 9, { align: 'right' })

  // "EINEN HERZSCHLAG VORAUS"
  // In der Vorlage: "EINEN" und "VORAUS" dunkel, "HERZSCHLAG" orange.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)

  const slogan1 = 'EINEN'
  const slogan2 = ' HERZSCHLAG'
  const slogan3 = ' VORAUS'

  // Wir zeichnen rechts-bündig: erst Gesamtbreite messen, dann von rechts platzieren
  const w1 = doc.getTextWidth(slogan1)
  const w2 = doc.getTextWidth(slogan2)
  const w3 = doc.getTextWidth(slogan3)
  const totalW = w1 + w2 + w3
  const startX = pageW - MR - totalW
  const sloY = MT + 18

  doc.setTextColor(...DARK)
  doc.text(slogan1, startX, sloY)
  doc.setTextColor(...ORANGE)
  doc.text(slogan2, startX + w1, sloY)
  doc.setTextColor(...DARK)
  doc.text(slogan3, startX + w1 + w2, sloY)
}

function drawBelegBox(doc, offer, pageW) {
  // Vorlage: 3-spaltig, ~70 mm breit, rechts-bündig zur Marge.
  const boxW = 70
  const boxX = pageW - MR - boxW
  const boxY = 60
  const headerH = 7
  const valueH = 8

  doc.setDrawColor(...DARK)
  doc.setLineWidth(0.3)

  // Außen-Rahmen
  doc.rect(boxX, boxY, boxW, headerH + valueH)

  // Trennlinie zwischen Header- und Wertereihe
  doc.line(boxX, boxY + headerH, boxX + boxW, boxY + headerH)

  // Vertikale Trennlinien (3 gleich breite Spalten)
  const colW = boxW / 3
  doc.line(boxX + colW,     boxY, boxX + colW,     boxY + headerH + valueH)
  doc.line(boxX + 2 * colW, boxY, boxX + 2 * colW, boxY + headerH + valueH)

  // Header-Texte
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...DARK)
  doc.text('Beleg-Nr.', boxX + colW * 0.5, boxY + 4.8, { align: 'center' })
  doc.text('Datum',     boxX + colW * 1.5, boxY + 4.8, { align: 'center' })
  doc.text('Kd-Nr.',    boxX + colW * 2.5, boxY + 4.8, { align: 'center' })

  // Werte
  doc.setFont('helvetica', 'normal')
  doc.text(offer.beleg_nr || '–',    boxX + colW * 0.5, boxY + headerH + 5.4, { align: 'center' })
  doc.text(formatDate(offer.datum),  boxX + colW * 1.5, boxY + headerH + 5.4, { align: 'center' })
  doc.text(offer.kd_nr || '–',       boxX + colW * 2.5, boxY + headerH + 5.4, { align: 'center' })
}

function drawGruppenzusammenstellung(doc, offer, gruppen, startY, pageW) {
  let y = startY

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...DARK)
  doc.text('G R U P P E N Z U S A M M E N S T E L L U N G', ML, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)

  let groupIdx = 1
  for (const gruppe of gruppen) {
    const grpNr = String(groupIdx).padStart(2, '0')
    const groupSum = (gruppe.positionen || []).reduce(
      (s, p) => s + (Number(p.menge) || 0) * (Number(p.preis) || 0), 0)
    doc.text(grpNr, ML, y)
    doc.text(gruppe.name || '', ML + 12, y)
    doc.text(fmt(groupSum), pageW - MR, y, { align: 'right' })
    y += 5
    groupIdx++
  }

  y += 1
  doc.setDrawColor(...DARK)
  doc.setLineWidth(0.3)
  doc.line(ML, y, pageW - MR, y)
  y += 5

  // Netto / MwSt / Brutto: Label links, [EUR] zentriert/links der Spalte, Wert rechts
  const labelX = ML + 12
  const eurX   = pageW - MR - 28
  const valX   = pageW - MR

  doc.setFont('helvetica', 'normal')
  doc.text('Nettobetrag', labelX, y)
  doc.text('[EUR]', eurX, y, { align: 'right' })
  doc.text(fmt(offer.netto), valX, y, { align: 'right' })
  y += 5

  doc.text('Mwst 20,00 %', labelX, y)
  doc.text('[EUR]', eurX, y, { align: 'right' })
  doc.text(fmt(offer.mwst), valX, y, { align: 'right' })
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Bruttobetrag', labelX, y)
  doc.text('[EUR]', eurX, y, { align: 'right' })
  doc.text(fmt(offer.brutto), valX, y, { align: 'right' })

  return y
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

function drawFooter(doc) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const fy = pageH - 18

  // Trennlinie
  doc.setDrawColor(...LIGHT_GRAY)
  doc.setLineWidth(0.2)
  doc.line(ML, fy - 4, pageW - MR, fy - 4)

  // Eigentumsvorbehalt zentriert
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.text(
    'Eigentumsvorbehalt: Die angeführten Lieferungen und Leistungen gehen erst nach vollständiger Bezahlung in das Eigentum des Auftraggebers über.',
    pageW / 2, fy - 1, { align: 'center' }
  )

  // Linke Spalte: Firma
  doc.setFontSize(7.5)
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
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

  // Rechte Spalte: Bank-/Firmen-Daten
  const rx = pageW - MR
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...DARK)
  doc.text('Steiermärkische Bank und Sparkassen AG: IBAN: AT74 2081 5166 0001 4555  |  BIC: STSPAT2GXXX', rx, fy + 3.5, { align: 'right' })
  doc.text('Raiffeisenbank Neumarkt-Oberwölz: IBAN: AT11 3840 2000 0204 4063  |  BIC: RZSTAT2G402', rx, fy + 7, { align: 'right' })
  doc.text('FN 405094 b – Gerichtsstand: Leoben  |  UID-Nr.: ATU 682 87 445', rx, fy + 10.5, { align: 'right' })
}
