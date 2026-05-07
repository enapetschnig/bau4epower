/**
 * Escapes HTML special characters to prevent XSS attacks.
 */
function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Builds an HTML email body for a Besprechungsprotokoll.
 */
export function buildProtokollHtml({ betrifft, adresse, projektnummer, protokollData = {}, protokollLink, erstelltVon }) {
  const now = new Date()
  const datum = now.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const uhrzeit = now.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })

  const punkte = protokollData.punkte || []
  const zusammenfassung = protokollData.zusammenfassung || ''
  const offenePunkte = protokollData.offene_punkte || []
  const zusatzPunkte = punkte.filter(p => p.ist_zusatzleistung)

  const punkteRows = punkte.map(p => `
    <tr style="${p.ist_zusatzleistung ? 'background:#fff7ed;' : ''}">
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;width:28px;vertical-align:top;">${p.nr}.</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
        <div style="font-weight:700;color:${p.ist_zusatzleistung ? '#c2410c' : '#2c3e50'};font-size:14px;">${escapeHtml(p.thema || '')}${p.ist_zusatzleistung ? ' ⚡' : ''}</div>
        ${p.beschreibung ? `<div style="color:#374151;font-size:13px;margin-top:3px;">${escapeHtml(p.beschreibung)}</div>` : ''}
        ${p.massnahme ? `<div style="color:#6b7280;font-size:12px;margin-top:3px;font-style:italic;">Maßnahme: ${escapeHtml(p.massnahme)}</div>` : ''}
        ${p.zustaendig ? `<div style="color:#6b7280;font-size:12px;margin-top:2px;">Zuständig: ${escapeHtml(p.zustaendig)}</div>` : ''}
      </td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="de">
<body style="margin:0;padding:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#f68714;padding:24px 32px;">
        <div style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">ET KÖNIG GmbH –Besprechungsprotokoll</div>
        <div style="font-size:13px;color:#f8d7d7;margin-top:4px;">${escapeHtml(betrifft) || 'Protokoll'}</div>
      </td></tr>
      <tr><td style="padding:24px 32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${projektnummer ? `<tr><td style="font-size:13px;color:#6b7280;padding:5px 0;width:38%;">Hero Projektnummer</td><td style="font-size:14px;font-weight:700;color:#2c3e50;padding:5px 0;">${escapeHtml(projektnummer)}</td></tr>` : ''}
          ${adresse ? `<tr><td style="font-size:13px;color:#6b7280;padding:5px 0;">Adresse</td><td style="font-size:14px;color:#2c3e50;padding:5px 0;">${escapeHtml(adresse)}</td></tr>` : ''}
          <tr><td style="font-size:13px;color:#6b7280;padding:5px 0;">Datum</td><td style="font-size:14px;color:#2c3e50;padding:5px 0;">${datum} um ${uhrzeit} Uhr</td></tr>
          <tr><td style="font-size:13px;color:#6b7280;padding:5px 0;">Erstellt von</td><td style="font-size:14px;color:#2c3e50;padding:5px 0;">${escapeHtml(erstelltVon) || '–'}</td></tr>
          <tr><td style="font-size:13px;color:#6b7280;padding:5px 0;">Punkte gesamt</td><td style="font-size:14px;color:#2c3e50;padding:5px 0;">${punkte.length}${zusatzPunkte.length > 0 ? ` (davon ${zusatzPunkte.length} Zusatzleistung${zusatzPunkte.length !== 1 ? 'en' : ''})` : ''}</td></tr>
        </table>
      </td></tr>
      ${zusatzPunkte.length > 0 ? `
      <tr><td style="padding:0 32px 16px;">
        <div style="background:#fff7ed;border-left:4px solid #f68714;padding:12px 16px;border-radius:0 6px 6px 0;">
          <div style="font-size:14px;font-weight:700;color:#f68714;margin-bottom:6px;">⚡ ${zusatzPunkte.length} Zusatzleistung${zusatzPunkte.length !== 1 ? 'en' : ''} erkannt</div>
          <ul style="margin:0;padding-left:18px;color:#7f1d1d;font-size:13px;line-height:1.8;">
            ${zusatzPunkte.map(p => `<li><strong>${escapeHtml(p.thema)}</strong> – ${escapeHtml(p.beschreibung)}</li>`).join('')}
          </ul>
        </div>
      </td></tr>` : ''}
      ${punkte.length > 0 ? `
      <tr><td style="padding:0 32px 16px;">
        <div style="font-size:15px;font-weight:700;color:#2c3e50;margin-bottom:10px;">Besprechungspunkte</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
          ${punkteRows}
        </table>
      </td></tr>` : ''}
      ${zusammenfassung ? `
      <tr><td style="padding:0 32px 16px;">
        <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:0 6px 6px 0;">
          <div style="font-size:13px;font-weight:700;color:#15803d;margin-bottom:6px;">Zusammenfassung</div>
          <div style="font-size:13px;color:#166534;line-height:1.6;">${escapeHtml(zusammenfassung)}</div>
        </div>
      </td></tr>` : ''}
      ${offenePunkte.length > 0 ? `
      <tr><td style="padding:0 32px 16px;">
        <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 6px 6px 0;">
          <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:6px;">Offene Punkte</div>
          <ul style="margin:0;padding-left:18px;color:#92400e;font-size:13px;line-height:1.8;">
            ${offenePunkte.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
          </ul>
        </div>
      </td></tr>` : ''}
      <tr><td style="padding:0 32px 32px;text-align:center;">
        <a href="${protokollLink}" style="display:inline-block;background:#f68714;color:#ffffff;font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">
          Protokoll öffnen
        </a>
      </td></tr>
      <tr><td style="background:#f5f6f8;padding:16px 32px;border-top:1px solid #e5e7eb;">
        <div style="font-size:11px;color:#9ca3af;text-align:center;">
          ET KÖNIG GmbH &nbsp;|&nbsp; Automatisch generiert am ${datum} um ${uhrzeit} Uhr
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

/**
 * Builds an HTML email body for a completed offer.
 * Used in the Make.com webhook payload as `htmlBody`.
 */
export function buildAngebotHtml({ betrifft, adresse, projektnummer, gewerke, netto, mwst, brutto, angebotLink, erstelltVon, empfaenger, ergaenzungen = [], hinweise = [] }) {
  const now = new Date()
  const datum = now.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const uhrzeit = now.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })

  const fmt = (val) => Number(val || 0).toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const gewerkeRows = (gewerke || []).map(g => {
    const anzahl = (g.positionen || []).length
    const summe = g.zwischensumme != null
      ? g.zwischensumme
      : (g.positionen || []).reduce((s, p) => s + (p.gesamtpreis || 0), 0)
    return `
      <tr>
        <td style="padding:7px 10px; border-bottom:1px solid #e5e7eb;">${escapeHtml(g.name) || '–'}</td>
        <td style="padding:7px 10px; border-bottom:1px solid #e5e7eb; text-align:center;">${anzahl}</td>
        <td style="padding:7px 10px; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:600;">${fmt(summe)} €</td>
      </tr>`
  }).join('')

  const gesamtPositionen = (gewerke || []).reduce((s, g) => s + (g.positionen || []).length, 0)

  return `<!DOCTYPE html>
<html lang="de">
<body style="margin:0;padding:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr><td style="background:#f68714;padding:24px 32px;">
        <div style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">ET KÖNIG GmbH –Neues Angebot</div>
        <div style="font-size:13px;color:#f8d7d7;margin-top:4px;">Zur Übertragung in Hero bereit</div>
      </td></tr>

      <!-- Eckdaten -->
      <tr><td style="padding:24px 32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:5px 0;width:38%;">Hero Projektnummer</td>
            <td style="font-size:14px;font-weight:700;color:#2c3e50;padding:5px 0;">${escapeHtml(projektnummer) || '–'}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:5px 0;">Adresse</td>
            <td style="font-size:14px;color:#2c3e50;padding:5px 0;">${escapeHtml(adresse) || '–'}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:5px 0;">Betrifft</td>
            <td style="font-size:14px;color:#2c3e50;padding:5px 0;">${escapeHtml(betrifft) || '–'}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:5px 0;">Positionen gesamt</td>
            <td style="font-size:14px;color:#2c3e50;padding:5px 0;">${gesamtPositionen}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:5px 0;">Erstellt von</td>
            <td style="font-size:14px;color:#2c3e50;padding:5px 0;">${escapeHtml(erstelltVon) || '–'}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding:5px 0;">Datum / Uhrzeit</td>
            <td style="font-size:14px;color:#2c3e50;padding:5px 0;">${datum} um ${uhrzeit} Uhr</td>
          </tr>
        </table>
      </td></tr>

      ${ergaenzungen.length > 0 ? `
      <!-- Ergänzungen -->
      <tr><td style="padding:0 32px 16px;">
        <div style="font-size:15px;font-weight:700;color:#2c3e50;margin-bottom:10px;">Ergänzungen</div>
        <ul style="margin:0;padding-left:18px;color:#374151;font-size:14px;line-height:1.7;">
          ${ergaenzungen.map(e => `<li>${escapeHtml(e)}</li>`).join('')}
        </ul>
      </td></tr>
      ` : ''}

      ${hinweise.length > 0 ? `
      <!-- Hinweise -->
      <tr><td style="padding:0 32px 16px;">
        <div style="font-size:15px;font-weight:700;color:#2c3e50;margin-bottom:10px;">Hinweise</div>
        <ul style="margin:0;padding-left:18px;color:#374151;font-size:14px;line-height:1.7;">
          ${hinweise.map(h => `<li>${escapeHtml(h)}</li>`).join('')}
        </ul>
      </td></tr>
      ` : ''}

      <!-- Gewerke-Tabelle -->
      <tr><td style="padding:0 32px 16px;">
        <div style="font-size:15px;font-weight:700;color:#2c3e50;margin-bottom:10px;">Gewerke</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
          <tr style="background:#f5f6f8;">
            <th style="padding:9px 10px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #f68714;">Gewerk</th>
            <th style="padding:9px 10px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #f68714;">Pos.</th>
            <th style="padding:9px 10px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #f68714;">Summe netto</th>
          </tr>
          ${gewerkeRows}
        </table>
      </td></tr>

      <!-- Summen -->
      <tr><td style="padding:0 32px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #e5e7eb;margin-top:4px;">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#6b7280;">Netto</td>
            <td style="padding:8px 0;font-size:14px;text-align:right;color:#2c3e50;">${fmt(netto)} €</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#6b7280;">MwSt 20 %</td>
            <td style="padding:4px 0;font-size:14px;text-align:right;color:#2c3e50;">${fmt(mwst)} €</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:10px 0;font-size:16px;font-weight:800;color:#2c3e50;">Brutto gesamt</td>
            <td style="padding:10px 0;font-size:18px;font-weight:800;text-align:right;color:#f68714;">${fmt(brutto)} €</td>
          </tr>
        </table>
      </td></tr>

      <!-- CTA -->
      <tr><td style="padding:0 32px 32px;text-align:center;">
        <a href="${angebotLink}"
           style="display:inline-block;background:#f68714;color:#ffffff;font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">
          Angebot öffnen &amp; in Hero übertragen
        </a>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f5f6f8;padding:16px 32px;border-top:1px solid #e5e7eb;">
        <div style="font-size:11px;color:#9ca3af;text-align:center;">
          ET KÖNIG GmbH &nbsp;|&nbsp; Automatisch generiert am ${datum} um ${uhrzeit} Uhr
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

/**
 * Builds an HTML email body for sending a PDF attachment.
 * Used when "PDF senden" is clicked – the email says "see attached PDF"
 * and Make.com attaches the actual PDF file.
 */
export function buildPdfEmailHtml({ betrifft, adresse, projektnummer, absenderName, type = 'angebot' }) {
  const now = new Date()
  const datum = now.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const uhrzeit = now.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })

  const label = type === 'protokoll' ? 'Besprechungsprotokoll' : 'Angebot'
  const headline = type === 'protokoll' ? 'ET KÖNIG GmbH –Besprechungsprotokoll' : 'ET KÖNIG GmbH –Angebot'

  return `<!DOCTYPE html>
<html lang="de">
<body style="margin:0;padding:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr><td style="background:#f68714;padding:24px 32px;">
        <div style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">${headline}</div>
        <div style="font-size:13px;color:#f8d7d7;margin-top:4px;">${escapeHtml(betrifft) || label}</div>
      </td></tr>

      <!-- Inhalt -->
      <tr><td style="padding:32px;">
        <div style="font-size:15px;color:#2c3e50;line-height:1.7;">
          Sehr geehrte Damen und Herren,<br><br>
          anbei erhalten Sie ${type === 'protokoll' ? 'das Besprechungsprotokoll' : 'unser Angebot'} als PDF-Dokument.
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#f5f6f8;border-radius:8px;">
          ${projektnummer ? `<tr><td style="font-size:13px;color:#6b7280;padding:10px 16px 4px;width:38%;">Hero Projektnummer</td><td style="font-size:14px;font-weight:700;color:#2c3e50;padding:10px 16px 4px;">${escapeHtml(projektnummer)}</td></tr>` : ''}
          ${adresse ? `<tr><td style="font-size:13px;color:#6b7280;padding:4px 16px;width:38%;">Adresse</td><td style="font-size:14px;color:#2c3e50;padding:4px 16px;">${escapeHtml(adresse)}</td></tr>` : ''}
          ${betrifft ? `<tr><td style="font-size:13px;color:#6b7280;padding:4px 16px 10px;width:38%;">Betrifft</td><td style="font-size:14px;color:#2c3e50;padding:4px 16px 10px;">${escapeHtml(betrifft)}</td></tr>` : ''}
        </table>

        <div style="font-size:14px;color:#2c3e50;line-height:1.7;">
          Bei Fragen stehen wir Ihnen gerne zur Verfügung.<br><br>
          Mit freundlichen Grüßen,<br>
          <strong>${escapeHtml(absenderName) || 'ET KÖNIG GmbH'}</strong>
        </div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f5f6f8;padding:16px 32px;border-top:1px solid #e5e7eb;">
        <div style="font-size:11px;color:#9ca3af;text-align:center;">
          ET KÖNIG GmbH &nbsp;|&nbsp; Gesendet am ${datum} um ${uhrzeit} Uhr
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}
