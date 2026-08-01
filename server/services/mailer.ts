import nodemailer from "nodemailer";

/**
 * Sends transactional email via SMTP. When SMTP credentials are not configured the
 * send is skipped and the details are logged, returning `false`.
 */
export async function sendEmailServer(
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || "";
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASS || "";
  const smtpFrom = process.env.SMTP_FROM || smtpUser || "noreply@qwickgig.com";

  if (!smtpUser || !smtpPass) {
    console.warn(
      `[SMTP Warning] SMTP credentials not configured (SMTP_USER/GMAIL_USER and SMTP_PASS/GMAIL_APP_PASS). Email sending skipped, but details logged below:\nTo: ${to}\nSubject: ${subject}\nText: ${text}`,
    );
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      text,
      html,
    });
    console.log(`Successfully sent SMTP email to ${to} with subject: "${subject}"`);
    return true;
  } catch (err: any) {
    console.error(`[SMTP Error] Failed to send email to ${to}:`, err.message || err);
    return false;
  }
}

interface EmailTemplateOptions {
  preheader?: string;
  title: string;
  salutation: string;
  bodyParagraphs: string[];
  extraDetailsHtml?: string;
  ctaText?: string;
  ctaUrl?: string;
}

export function buildQwickGigEmailHtml(options: EmailTemplateOptions): string {
  const {
    preheader = "",
    title,
    salutation,
    bodyParagraphs,
    extraDetailsHtml = "",
    ctaText,
    ctaUrl,
  } = options;

  const appUrl = process.env.APP_URL || "https://qwickgig.com";

  const paragraphsHtml = bodyParagraphs
    .map(
      (p) =>
        `<p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0; text-align: left;">${p}</p>`,
    )
    .join("");

  let ctaHtml = "";
  if (ctaText && ctaUrl) {
    ctaHtml = `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0; text-align: center;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
              <tr>
                <td align="center" bgcolor="#4F46E5" style="border-radius: 8px;">
                  <a href="${ctaUrl}" target="_blank" style="font-size: 15px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 700; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; display: inline-block; border: 1px solid #4F46E5; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.15);">
                    ${ctaText}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${title}</title>
  <!--[if mso]>
  <style>
    * { font-family: sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: #F8FAFC; -webkit-font-smoothing: antialiased; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%;">
  <span style="display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; mso-hide: all; font-size: 0px; max-height: 0px; max-width: 0px; overflow: hidden;">${preheader}</span>
  
  <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#F8FAFC" style="background-color: #F8FAFC; padding: 40px 10px;">
    <tr>
      <td align="center" valign="top">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03); overflow: hidden;">
          <!-- Card Header / Logo -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #F1F5F9;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <span style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 28px; font-weight: 800; color: #4F46E5; letter-spacing: -0.03em; display: inline-block; vertical-align: middle;">⚡ QwickGig</span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 4px;">
                    <span style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #64748B; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em;">Your Friendly Neighborhood Gig Network</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Card Body Content -->
          <tr>
            <td style="padding: 32px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 18px 0; text-align: left; letter-spacing: -0.015em;">${salutation}</h2>
              
              ${paragraphsHtml}
              
              ${extraDetailsHtml}
              
              ${ctaHtml}
            </td>
          </tr>
          
          <!-- Card Footer -->
          <tr>
            <td style="padding: 32px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="font-size: 13px; font-weight: 800; color: #0F172A; margin-bottom: 2px;">
                    ⚡ QwickGig
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size: 11px; color: #64748B; padding-top: 2px; padding-bottom: 12px;">
                    Local Help, Instantly.
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size: 11px; color: #94A3B8; line-height: 1.6;">
                    This is an automated message from QwickGig.<br />
                    Please do not reply directly to this email.<br />
                    For support, contact <a href="mailto:support@qwickgig.com" style="color: #4F46E5; text-decoration: underline; font-weight: 500;">support@qwickgig.com</a> or visit our <a href="${appUrl}" style="color: #4F46E5; text-decoration: underline; font-weight: 500;">Help Center</a>.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getWelcomeEmail(fullName: string, appUrl: string) {
  const title = "Welcome to QwickGig! 👋 Here's how it works";
  const salutation = `Welcome to the neighborhood, ${fullName}! 👋`;
  const bodyParagraphs = [
    "We're absolutely thrilled to welcome you to QwickGig! Whether you're here to cross things off your to-do list, earn some extra income, or simply connect with your local community, you've come to the right place.",
    "QwickGig is built on neighborhood trust, offering real-time messaging, secure user profiles, and easy gig coordination. Here's how to make the most of it:",
  ];

  const extraDetailsHtml = `
    <div style="background-color: #F8FAFC; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #E2E8F0;">
      <h3 style="color: #0F172A; font-family: sans-serif; font-size: 14px; font-weight: 800; margin-top: 0; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #E2E8F0; padding-bottom: 8px;">🛠️ How QwickGig Works</h3>
      
      <div style="margin-bottom: 16px;">
        <div style="font-weight: 700; color: #0F172A; font-size: 14px; margin-bottom: 4px;">1. Post a Gig (If you need a hand)</div>
        <div style="color: #475569; font-size: 13px; line-height: 1.5;">Tap "Post a Gig", write details about what you need done, specify your budget, and set your location. It goes live instantly for helpers in your area!</div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="font-weight: 700; color: #0F172A; font-size: 14px; margin-bottom: 4px;">2. Browse & Negotiate (If you want to earn)</div>
        <div style="color: #475569; font-size: 13px; line-height: 1.5;">Browse live tasks near you. When you find one you like, tap "I'm Interested" and propose your rate to the gig owner.</div>
      </div>
      
      <div>
        <div style="font-weight: 700; color: #0F172A; font-size: 14px; margin-bottom: 4px;">3. Chat, Accept & Complete</div>
        <div style="color: #475569; font-size: 13px; line-height: 1.5;">Discuss details securely inside our built-in real-time inbox. Once a rate/time is agreed upon, accept the proposal to start! Mark as completed when the job is done.</div>
      </div>
    </div>
  `;

  const html = buildQwickGigEmailHtml({
    preheader: "Get started with your friendly neighborhood gig network.",
    title,
    salutation,
    bodyParagraphs,
    extraDetailsHtml,
    ctaText: "Explore Open Gigs",
    ctaUrl: appUrl,
  });

  const text = `Welcome to the neighborhood, ${fullName}! 👋

We're absolutely thrilled to welcome you to QwickGig! Whether you're here to cross things off your to-do list, earn some extra income, or simply connect with your local community, you've come to the right place.

🛠️ HOW QWICKGIG WORKS:

1. Post a Gig (If you need a hand)
   Tap "Post a Gig", write details about what you need done, and specify your budget and location. It goes live instantly for helpers in your area!

2. Browse & Negotiate (If you want to earn)
   Browse live tasks near you. When you find one you like, tap "I'm Interested" and propose or negotiate your rate.

3. Chat, Accept & Complete
   Discuss details securely inside our built-in real-time inbox. Once a rate/time is agreed upon, accept the proposal to start! Mark as completed when the job is done.

Start exploring open gigs: ${appUrl}

Best regards,
The QwickGig Team
--------------------------------------------------
This is an automated message from QwickGig.
Please do not reply directly to this email.
For support, contact support@qwickgig.com or visit our Help Center at ${appUrl}`;

  return { subject: title, html, text };
}

export function getInboxMessageEmail(
  senderName: string,
  messageContent: string,
  gigTitle: string,
  appUrl: string,
  threadId?: string,
) {
  const subject = `💬 New Message from ${senderName} on QwickGig`;
  const salutation = "New Message Received! 💬";
  const bodyParagraphs = [
    `You have received a new message from <strong>${senderName}</strong> regarding your chat thread on QwickGig for the gig: <strong>"${gigTitle}"</strong>.`,
  ];

  const preview = messageContent
    ? messageContent.length > 200
      ? messageContent.substring(0, 200) + "..."
      : messageContent
    : "";
  const extraDetailsHtml = `
    <div style="background-color: #F8FAFC; border-left: 4px solid #4F46E5; padding: 20px; border-radius: 8px; font-style: italic; color: #475569; margin: 20px 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">"${preview}"</div>
  `;

  const ctaUrl = threadId ? `${appUrl}?redirect=/chat/${threadId}` : appUrl;

  const html = buildQwickGigEmailHtml({
    preheader: `${senderName} sent you a message: "${preview.substring(0, 50)}"`,
    title: subject,
    salutation,
    bodyParagraphs,
    extraDetailsHtml,
    ctaText: "View Message",
    ctaUrl: ctaUrl,
  });

  const text = `New Message on QwickGig 💬

${senderName} sent you a message regarding "${gigTitle}":
"${preview}"

Reply to this message on QwickGig: ${ctaUrl}

Best regards,
The QwickGig Team
--------------------------------------------------
This is an automated message from QwickGig.
Please do not reply directly to this email.
For support, contact support@qwickgig.com or visit our Help Center at ${appUrl}`;

  return { subject, html, text };
}

export function getGigInterestEmail(
  senderName: string,
  gigTitle: string,
  price: number | undefined,
  appUrl: string,
  gigId?: string,
) {
  const subject = `🔔 New Interest on QwickGig for "${gigTitle}"`;
  const salutation = "Someone is Interested in Your Gig! 🔔";
  const bodyParagraphs = [
    `Great news! <strong>${senderName}</strong> has expressed interest in helping with your gig: <strong>"${gigTitle}"</strong>.`,
    "You can now chat directly with them in your inbox to coordinate details, confirm qualifications, and finalize the agreement.",
  ];

  const rateStr = price !== undefined ? `₹${price}` : "N/A";
  const extraDetailsHtml = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px; margin: 20px 0;">
      <tr>
        <td style="font-size: 12px; color: #64748B; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 4px; font-family: sans-serif;">Proposed Rate</td>
      </tr>
      <tr>
        <td style="font-size: 24px; color: #0F172A; font-weight: 800; font-family: sans-serif;">${rateStr}</td>
      </tr>
    </table>
  `;

  const ctaUrl = gigId ? `${appUrl}?redirect=/gig/${gigId}` : appUrl;

  const html = buildQwickGigEmailHtml({
    preheader: `${senderName} is interested in your gig: "${gigTitle}" at ${rateStr}.`,
    title: subject,
    salutation,
    bodyParagraphs,
    extraDetailsHtml,
    ctaText: "See Your Gig",
    ctaUrl: ctaUrl,
  });

  const text = `Someone is Interested in Your Gig! 🔔

${senderName} has expressed interest in your gig "${gigTitle}" with a proposed rate of ${rateStr}.

Review interest and chat now: ${ctaUrl}

Best regards,
The QwickGig Team
--------------------------------------------------
This is an automated message from QwickGig.
Please do not reply directly to this email.
For support, contact support@qwickgig.com or visit our Help Center at ${appUrl}`;

  return { subject, html, text };
}

export function getProposalAcceptedEmail(
  senderName: string,
  gigTitle: string,
  price: number | undefined,
  appUrl: string,
  threadId?: string,
) {
  const subject = `🎉 Your Proposal Was Accepted on QwickGig!`;
  const salutation = "Your Proposal Was Accepted! 🎉";
  const bodyParagraphs = [
    `Congratulations! <strong>${senderName}</strong> has chosen you to help with their gig: <strong>"${gigTitle}"</strong>.`,
    "Your proposal is officially accepted, and the gig status has been updated to <strong>In Progress</strong>. Please head over to your inbox to coordinate the scheduled time, location details, and complete the work.",
  ];

  const agreedRate = price !== undefined ? `₹${price}` : "the agreed rate";
  const extraDetailsHtml = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px; margin: 20px 0;">
      <tr>
        <td style="padding-bottom: 12px; border-bottom: 1px solid #E2E8F0; font-family: sans-serif;">
          <div style="font-size: 12px; color: #64748B; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Agreed Rate</div>
          <div style="font-size: 20px; color: #0F172A; font-weight: 800;">${agreedRate}</div>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 12px; font-family: sans-serif;">
          <div style="font-size: 12px; color: #64748B; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Gig Status</div>
          <div style="font-size: 15px; color: #059669; font-weight: 700; display: inline-block;">● In Progress</div>
        </td>
      </tr>
    </table>
  `;

  const ctaUrl = threadId ? `${appUrl}?redirect=/chat/${threadId}` : appUrl;

  const html = buildQwickGigEmailHtml({
    preheader: `Congratulations! ${senderName} accepted your proposal for "${gigTitle}" at ${agreedRate}.`,
    title: subject,
    salutation,
    bodyParagraphs,
    extraDetailsHtml,
    ctaText: "Open Chat Thread",
    ctaUrl: ctaUrl,
  });

  const text = `Your Proposal Was Accepted! 🎉

Congratulations! ${senderName} has chosen you to help with the gig "${gigTitle}" at the agreed rate of ${agreedRate}.

The gig is now officially "In Progress". Open QwickGig to coordinate with ${senderName}: ${ctaUrl}

Best regards,
The QwickGig Team
--------------------------------------------------
This is an automated message from QwickGig.
Please do not reply directly to this email.
For support, contact support@qwickgig.com or visit our Help Center at ${appUrl}`;

  return { subject, html, text };
}

export function getNegotiationProposedEmail(
  senderName: string,
  gigTitle: string,
  proposedPrice: number,
  appUrl: string,
  gigId?: string,
) {
  const subject = `💬 New Price Proposal on QwickGig: ₹${proposedPrice}`;
  const salutation = "New Price Proposed! 💬";
  const bodyParagraphs = [
    `<strong>${senderName}</strong> has proposed a new rate of <strong>₹${proposedPrice}</strong> for the gig <strong>"${gigTitle}"</strong>.`,
    "Please review this proposal in your chat and reply to accept or negotiate further.",
  ];

  const extraDetailsHtml = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px; margin: 20px 0;">
      <tr>
        <td style="font-size: 12px; color: #64748B; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 4px; font-family: sans-serif;">Proposed Price</td>
      </tr>
      <tr>
        <td style="font-size: 24px; color: #0F172A; font-weight: 800; font-family: sans-serif;">₹${proposedPrice}</td>
      </tr>
    </table>
  `;

  const ctaUrl = gigId ? `${appUrl}?redirect=/gig/${gigId}` : appUrl;

  const html = buildQwickGigEmailHtml({
    preheader: `${senderName} proposed ₹${proposedPrice} for "${gigTitle}".`,
    title: subject,
    salutation,
    bodyParagraphs,
    extraDetailsHtml,
    ctaText: "Review Proposal",
    ctaUrl: ctaUrl,
  });

  const text = `New Price Proposal on QwickGig 💬

${senderName} has proposed a new rate of ₹${proposedPrice} for the gig "${gigTitle}".

Review and reply on QwickGig: ${ctaUrl}

Best regards,
The QwickGig Team
--------------------------------------------------
This is an automated message from QwickGig.
Please do not reply directly to this email.
For support, contact support@qwickgig.com or visit our Help Center at ${appUrl}`;

  return { subject, html, text };
}

export function getPosterDurationEndedEmail(
  posterName: string,
  workerName: string,
  gigTitle: string,
  appUrl: string,
  redirectUrl: string,
) {
  const subject = `⏳ Gig Timeframe Concluded: "${gigTitle}"`;
  const salutation = "Gig Timeframe Ended! ⏳";
  const bodyParagraphs = [
    `Hello ${posterName},`,
    `The scheduled timeframe for your gig <strong>"${gigTitle}"</strong> has ended.`,
    `Please confirm if the work was completed to your satisfaction by <strong>${workerName}</strong>. Once done, you can mark the gig as completed and leave a review to complete the transaction.`,
  ];

  const html = buildQwickGigEmailHtml({
    preheader: `The timeframe for "${gigTitle}" has concluded. Mark it complete.`,
    title: subject,
    salutation,
    bodyParagraphs,
    ctaText: "Confirm and Rate Worker",
    ctaUrl: redirectUrl,
  });

  const text = `Gig Timeframe Ended! ⏳
Hello ${posterName},
The scheduled timeframe for your gig "${gigTitle}" has ended.

Please confirm if the work was completed by ${workerName}. Mark it as completed and leave feedback: ${redirectUrl}

Best regards,
The QwickGig Team
--------------------------------------------------
This is an automated message from QwickGig.
Please do not reply directly to this email.
For support, contact support@qwickgig.com or visit our Help Center at ${appUrl}`;

  return { subject, html, text };
}

export function getWorkerDurationEndedEmail(
  workerName: string,
  posterName: string,
  gigTitle: string,
  appUrl: string,
  redirectUrl: string,
) {
  const subject = `⏳ Gig Timeframe Concluded: "${gigTitle}"`;
  const salutation = "Gig Timeframe Ended! ⏳";
  const bodyParagraphs = [
    `Hello ${workerName},`,
    `The scheduled timeframe for the gig <strong>"${gigTitle}"</strong> with <strong>${posterName}</strong> has ended.`,
    `Please coordinate with <strong>${posterName}</strong> to mark the gig as completed and submit it for payment. Don't forget to leave feedback/rating for <strong>${posterName}</strong> as well!`,
  ];

  const html = buildQwickGigEmailHtml({
    preheader: `The timeframe for "${gigTitle}" has concluded. Coordinate completion.`,
    title: subject,
    salutation,
    bodyParagraphs,
    ctaText: "Coordinate Completion",
    ctaUrl: redirectUrl,
  });

  const text = `Gig Timeframe Ended! ⏳
Hello ${workerName},
The scheduled timeframe for the gig "${gigTitle}" with ${posterName} has ended.

Coordinate with ${posterName} to mark it complete and submit it for payment: ${redirectUrl}

Best regards,
The QwickGig Team
--------------------------------------------------
This is an automated message from QwickGig.
Please do not reply directly to this email.
For support, contact support@qwickgig.com or visit our Help Center at ${appUrl}`;

  return { subject, html, text };
}

export function getPasswordResetEmail(resetLink: string, appUrl: string) {
  const subject = "Reset Your Password";
  const salutation = "Reset Your Password 🔒";
  const bodyParagraphs = [
    "A password reset request has been initiated for your QwickGig account. To secure your account and set a new password, click the button below within the next 30 minutes:",
    "If you did not request a password reset, you can safely ignore this email. Your current password will remain secure and active.",
  ];

  const extraDetailsHtml = `
    <p style="font-size: 13px; color: #64748B; margin-top: 24px; margin-bottom: 8px; text-align: left; font-family: sans-serif;">If the button above does not work, copy and paste this link into your browser:</p>
    <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; padding: 12px; border-radius: 8px; word-break: break-all; font-size: 13px; font-family: monospace; color: #4F46E5; text-align: left;">
      <a href="${resetLink}" target="_blank" style="color: #4F46E5; text-decoration: none;">${resetLink}</a>
    </div>
  `;

  const html = buildQwickGigEmailHtml({
    preheader: "Reset your QwickGig account password secure and fast.",
    title: subject,
    salutation,
    bodyParagraphs,
    extraDetailsHtml,
    ctaText: "Reset Password",
    ctaUrl: resetLink,
  });

  const text = `Reset Your Password 🔒

A password reset has been requested for your QwickGig account. You can reset your password by clicking on the link below (expires in 30 minutes):

${resetLink}

If you did not request a password reset, you can safely ignore this email.

Best regards,
The QwickGig Team
--------------------------------------------------
This is an automated message from QwickGig.
Please do not reply directly to this email.
For support, contact support@qwickgig.com or visit our Help Center at ${appUrl}`;

  return { subject, html, text };
}
