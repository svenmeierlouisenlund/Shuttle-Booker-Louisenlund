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
