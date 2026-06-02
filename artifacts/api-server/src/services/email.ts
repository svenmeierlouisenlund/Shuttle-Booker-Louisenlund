import nodemailer from "nodemailer";
import { db } from "@workspace/db";
import { notificationEmailsTable } from "@workspace/db";
import type { Booking } from "@workspace/db";

const zoneLabels: Record<string, string> = {
  zone1: "Tarifzone 1",
  zone2: "Tarifzone 2",
  zone3: "Tarifzone 3",
  none: "Keine",
};
const typeLabels: Record<string, string> = {
  full_year: "Gesamtes Schuljahr 2026/27",
  first_half: "1. Schulhalbjahr 2026/27",
};
const statusLabels: Record<string, string> = {
  received: "Eingegangen",
  reviewed: "Geprüft",
  confirmed: "Bestätigt",
  query_open: "Rückfrage offen",
};

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true";

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendBookingNotification(
  booking: Booking,
  siblings: { childName: string; gradeYear: string; outboundRoute: string; returnRoute: string }[]
): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    return;
  }

  const recipients = await db.select().from(notificationEmailsTable);
  if (recipients.length === 0) {
    return;
  }

  const from = process.env.SMTP_FROM ?? `noreply@louisenlund.de`;
  const to = recipients.map((r) => r.email).join(", ");

  const siblingSection =
    siblings.length > 0
      ? `\n\nGeschwisterkinder (${siblings.length}):\n` +
        siblings
          .map(
            (s, i) =>
              `  ${i + 1}. ${s.childName} (${s.gradeYear}) – Hinfahrt: ${zoneLabels[s.outboundRoute] ?? s.outboundRoute}, Rückfahrt: ${zoneLabels[s.returnRoute] ?? s.returnRoute}`
          )
          .join("\n")
      : "";

  const text = `
Neue Anmeldung Regionalshuttle Louisenlund
==========================================

Referenznummer: ${booking.referenceNumber}
Eingegangen am: ${booking.createdAt.toLocaleDateString("de-DE")} um ${booking.createdAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr

ANGABEN ZUM KIND
----------------
Name:            ${booking.childName}
Adresse:         ${booking.childAddress}
Klasse:          ${booking.gradeYear}
Schülernummer:   ${booking.studentNumber ?? "–"}

ANGABEN DER ERZIEHUNGSBERECHTIGTEN
-----------------------------------
Name:            ${booking.parentName}
E-Mail:          ${booking.parentEmail}
Telefon:         ${booking.parentPhone}

BUCHUNGSDETAILS
---------------
Tarifzone:       ${zoneLabels[booking.tariffZone] ?? booking.tariffZone}
Buchungsart:     ${typeLabels[booking.bookingType] ?? booking.bookingType}
Hinfahrt:        ${zoneLabels[booking.outboundRoute] ?? booking.outboundRoute}
Rückfahrt:       ${zoneLabels[booking.returnRoute] ?? booking.returnRoute}${siblingSection}

Status: ${statusLabels[booking.status] ?? booking.status}

Diese E-Mail wurde automatisch verschickt.
Zur Verwaltung: ${process.env.ADMIN_URL ?? "https://louisenlund.de/admin"}
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><style>
  body { font-family: 'Arial', sans-serif; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
  .container { max-width: 600px; margin: 24px auto; background: #fff; border-radius: 4px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
  .header { background: #004289; color: #fff; padding: 20px 24px 16px; }
  .header .accent { height: 4px; background: #ce1329; margin-bottom: 16px; }
  .header h1 { margin: 0; font-size: 18px; font-weight: 700; }
  .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.85; }
  .ref { background: #f0f4fa; border-left: 4px solid #004289; padding: 12px 16px; margin: 20px 24px; border-radius: 0 4px 4px 0; }
  .ref strong { font-size: 15px; color: #004289; }
  .section { padding: 0 24px 16px; }
  .section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin: 16px 0 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 5px 0; font-size: 14px; vertical-align: top; }
  td:first-child { color: #666; width: 140px; }
  td:last-child { font-weight: 500; }
  .footer { background: #f9f9f9; border-top: 1px solid #eee; padding: 12px 24px; font-size: 12px; color: #aaa; text-align: center; }
  .badge { display: inline-block; background: #e8f0fb; color: #004289; border-radius: 3px; padding: 2px 8px; font-size: 12px; font-weight: 600; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <div class="accent"></div>
    <h1>Neue Anmeldung Regionalshuttle</h1>
    <p>Stiftung Louisenlund &bull; Schuljahr 2026/27</p>
  </div>
  <div class="ref">
    <strong>Referenznummer: ${booking.referenceNumber}</strong><br>
    <span style="font-size:12px;color:#666;">Eingegangen am ${booking.createdAt.toLocaleDateString("de-DE")} um ${booking.createdAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr</span>
  </div>
  <div class="section">
    <h2>Angaben zum Kind</h2>
    <table>
      <tr><td>Name</td><td>${booking.childName}</td></tr>
      <tr><td>Adresse</td><td>${booking.childAddress}</td></tr>
      <tr><td>Klasse</td><td>${booking.gradeYear}</td></tr>
      <tr><td>Schülernummer</td><td>${booking.studentNumber ?? "–"}</td></tr>
    </table>
    <h2>Erziehungsberechtigte</h2>
    <table>
      <tr><td>Name</td><td>${booking.parentName}</td></tr>
      <tr><td>E-Mail</td><td><a href="mailto:${booking.parentEmail}" style="color:#004289">${booking.parentEmail}</a></td></tr>
      <tr><td>Telefon</td><td>${booking.parentPhone}</td></tr>
    </table>
    <h2>Buchungsdetails</h2>
    <table>
      <tr><td>Tarifzone</td><td>${zoneLabels[booking.tariffZone] ?? booking.tariffZone}</td></tr>
      <tr><td>Buchungsart</td><td>${typeLabels[booking.bookingType] ?? booking.bookingType}</td></tr>
      <tr><td>Hinfahrt</td><td>${zoneLabels[booking.outboundRoute] ?? booking.outboundRoute}</td></tr>
      <tr><td>Rückfahrt</td><td>${zoneLabels[booking.returnRoute] ?? booking.returnRoute}</td></tr>
    </table>
    ${
      siblings.length > 0
        ? `<h2>Geschwisterkinder (${siblings.length})</h2>` +
          siblings
            .map(
              (s, i) => `
      <table style="margin-bottom:8px">
        <tr><td style="color:#004289;font-weight:600" colspan="2">${i + 1}. ${s.childName}</td></tr>
        <tr><td>Klasse</td><td>${s.gradeYear}</td></tr>
        <tr><td>Hinfahrt</td><td>${zoneLabels[s.outboundRoute] ?? s.outboundRoute}</td></tr>
        <tr><td>Rückfahrt</td><td>${zoneLabels[s.returnRoute] ?? s.returnRoute}</td></tr>
      </table>`
            )
            .join("")
        : ""
    }
  </div>
  <div class="footer">
    Diese E-Mail wurde automatisch vom Buchungssystem Regionalshuttle Louisenlund versandt.
  </div>
</div>
</body>
</html>
`.trim();

  await transporter.sendMail({
    from,
    to,
    subject: `Neue Anmeldung Regionalshuttle: ${booking.childName} (${booking.referenceNumber})`,
    text,
    html,
  });
}

export async function sendParentConfirmation(
  booking: Booking,
  siblings: { childName: string; gradeYear: string; outboundRoute: string; returnRoute: string }[]
): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    return;
  }

  const from = process.env.SMTP_FROM ?? `noreply@louisenlund.de`;
  const to = booking.parentEmail;

  const siblingSection =
    siblings.length > 0
      ? `\n\nGeschwisterkinder (${siblings.length}):\n` +
        siblings
          .map(
            (s, i) =>
              `  ${i + 1}. ${s.childName} (${s.gradeYear}) – Hinfahrt: ${zoneLabels[s.outboundRoute] ?? s.outboundRoute}, Rückfahrt: ${zoneLabels[s.returnRoute] ?? s.returnRoute}`
          )
          .join("\n")
      : "";

  const text = `
Sehr geehrte/r ${booking.parentName},

vielen Dank für Ihre Anmeldung beim Regionalshuttle der Stiftung Louisenlund für das Schuljahr 2026/27.

Ihre Anmeldung ist bei uns eingegangen und wird zeitnah bearbeitet.

IHRE REFERENZNUMMER: ${booking.referenceNumber}

Bitte bewahren Sie diese Referenznummer für spätere Rückfragen auf.

ZUSAMMENFASSUNG IHRER ANMELDUNG
--------------------------------
Name des Kindes:   ${booking.childName}
Klasse:            ${booking.gradeYear}
Tarifzone:         ${zoneLabels[booking.tariffZone] ?? booking.tariffZone}
Buchungsart:       ${typeLabels[booking.bookingType] ?? booking.bookingType}
Hinfahrt:          ${zoneLabels[booking.outboundRoute] ?? booking.outboundRoute}
Rückfahrt:         ${zoneLabels[booking.returnRoute] ?? booking.returnRoute}${siblingSection}

Eingegangen am: ${booking.createdAt.toLocaleDateString("de-DE")} um ${booking.createdAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr

Bitte beachten Sie, dass Ihre Buchung verbindlich ist. Bei Rückfragen wenden Sie sich bitte an die Stiftung Louisenlund.

Mit freundlichen Grüßen
Stiftung Louisenlund
Regionalshuttle 2026/27
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><style>
  body { font-family: 'Arial', sans-serif; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
  .container { max-width: 600px; margin: 24px auto; background: #fff; border-radius: 4px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
  .header { background: #004289; color: #fff; padding: 20px 24px 16px; }
  .header .accent { height: 4px; background: #ce1329; margin-bottom: 16px; }
  .header h1 { margin: 0; font-size: 18px; font-weight: 700; }
  .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.85; }
  .intro { padding: 20px 24px 0; font-size: 15px; line-height: 1.6; }
  .ref { background: #f0f4fa; border-left: 4px solid #004289; padding: 14px 20px; margin: 20px 24px; border-radius: 0 4px 4px 0; }
  .ref .ref-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .ref .ref-number { font-size: 22px; font-weight: 700; color: #004289; letter-spacing: 1px; }
  .ref .ref-hint { font-size: 12px; color: #888; margin-top: 6px; }
  .section { padding: 0 24px 16px; }
  .section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin: 16px 0 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 5px 0; font-size: 14px; vertical-align: top; }
  td:first-child { color: #666; width: 140px; }
  td:last-child { font-weight: 500; }
  .note { background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 12px 16px; margin: 0 24px 20px; font-size: 13px; color: #92400e; }
  .footer { background: #f9f9f9; border-top: 1px solid #eee; padding: 16px 24px; font-size: 12px; color: #aaa; }
  .footer p { margin: 2px 0; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <div class="accent"></div>
    <h1>Anmeldebestätigung Regionalshuttle</h1>
    <p>Stiftung Louisenlund &bull; Schuljahr 2026/27</p>
  </div>
  <div class="intro">
    <p>Sehr geehrte/r ${booking.parentName},</p>
    <p>vielen Dank für Ihre Anmeldung beim Regionalshuttle der Stiftung Louisenlund. Ihre Anmeldung ist bei uns eingegangen und wird zeitnah bearbeitet.</p>
  </div>
  <div class="ref">
    <div class="ref-label">Ihre Referenznummer</div>
    <div class="ref-number">${booking.referenceNumber}</div>
    <div class="ref-hint">Bitte bewahren Sie diese Nummer für spätere Rückfragen auf.</div>
  </div>
  <div class="section">
    <h2>Zusammenfassung Ihrer Anmeldung</h2>
    <table>
      <tr><td>Kind</td><td>${booking.childName}</td></tr>
      <tr><td>Klasse</td><td>${booking.gradeYear}</td></tr>
      <tr><td>Tarifzone</td><td>${zoneLabels[booking.tariffZone] ?? booking.tariffZone}</td></tr>
      <tr><td>Buchungsart</td><td>${typeLabels[booking.bookingType] ?? booking.bookingType}</td></tr>
      <tr><td>Hinfahrt</td><td>${zoneLabels[booking.outboundRoute] ?? booking.outboundRoute}</td></tr>
      <tr><td>Rückfahrt</td><td>${zoneLabels[booking.returnRoute] ?? booking.returnRoute}</td></tr>
      <tr><td>Eingegangen am</td><td>${booking.createdAt.toLocaleDateString("de-DE")} um ${booking.createdAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr</td></tr>
    </table>
    ${
      siblings.length > 0
        ? `<h2>Geschwisterkinder (${siblings.length})</h2>` +
          siblings
            .map(
              (s, i) => `
    <table style="margin-bottom:8px">
      <tr><td style="color:#004289;font-weight:600" colspan="2">${i + 1}. ${s.childName}</td></tr>
      <tr><td>Klasse</td><td>${s.gradeYear}</td></tr>
      <tr><td>Hinfahrt</td><td>${zoneLabels[s.outboundRoute] ?? s.outboundRoute}</td></tr>
      <tr><td>Rückfahrt</td><td>${zoneLabels[s.returnRoute] ?? s.returnRoute}</td></tr>
    </table>`
            )
            .join("")
        : ""
    }
  </div>
  <div class="note">
    <strong>Hinweis:</strong> Ihre Buchung ist verbindlich. Bei Rückfragen wenden Sie sich bitte direkt an die Stiftung Louisenlund.
  </div>
  <div class="footer">
    <p>Stiftung Louisenlund &bull; Regionalshuttle 2026/27</p>
    <p>Diese E-Mail wurde automatisch versandt. Bitte antworten Sie nicht direkt auf diese E-Mail.</p>
  </div>
</div>
</body>
</html>
`.trim();

  await transporter.sendMail({
    from,
    to,
    subject: `Anmeldebestätigung Regionalshuttle Louisenlund – ${booking.referenceNumber}`,
    text,
    html,
  });
}
