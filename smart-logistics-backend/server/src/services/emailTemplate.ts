// Palette mirrors smart-logistics-frontend/client/src/index.css, including teal/navy dark mode.
// Self-contained transactional email renderer. Dynamic values are escaped once.
const shell = String.raw`<!doctype html>
<html lang="@@LANG@@"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>@@TITLE@@</title>
<style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}body{margin:0;padding:0}table{border-collapse:collapse}img{border:0;outline:none;text-decoration:none}a:focus-visible{outline:3px solid @@ACCENT@@;outline-offset:4px}p{margin:0 0 18px}@media(max-width:620px){.outer{padding:20px 12px!important}.content{padding:28px 22px!important}.heading{font-size:23px!important;line-height:29px!important}.footer{padding:24px 22px!important}}@media(prefers-color-scheme:dark){.canvas{background:#0d1725!important}.card{background:#142235!important;border-color:#2a3d52!important}.ink{color:#e5edf6!important}.copy{color:#e5edf6!important}.muted{color:#a6b7c9!important}.panel,.notice{background:#1e3045!important;border-color:#5ed3e4!important}.rule{border-color:#2a3d52!important}.url{color:#5ed3e4!important}.accent-fill,.button{background:#5ed3e4!important;color:#102332!important}.button-label{color:#102332!important;border-color:#5ed3e4!important}}</style></head>
<body class="canvas" style="background:#f3f6fa;color:#172b42;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">@@PREHEADER@@</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="outer" align="center" style="padding:40px 16px;">
<!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->
<table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #d7e1eb;border-radius:16px;border-collapse:separate;border-spacing:0;">
<tr><td class="accent-fill" style="height:4px;background:@@ACCENT@@;border-radius:15px 15px 0 0;font-size:0;line-height:4px;">&nbsp;</td></tr>
<tr><td class="content" style="padding:36px 40px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px;"><tr><td width="44" style="width:44px;vertical-align:middle;"><img src="cid:onesa-company-logo" width="44" height="44" alt="" style="display:block;width:44px;height:44px;"></td><td style="padding-left:12px;"><div class="ink" style="font-size:23px;line-height:28px;font-weight:700;letter-spacing:3px;color:#172b42;">ONESA</div><div class="muted" style="margin-top:3px;font-size:11px;line-height:17px;letter-spacing:.6px;color:#51657b;">@@BRAND@@</div></td></tr></table>
<h1 class="heading ink" style="margin:0 0 18px;font-size:26px;line-height:32px;font-weight:700;letter-spacing:-.7px;color:#172b42;overflow-wrap:anywhere;">@@HEADING@@</h1>
<div class="copy" style="font-size:16px;line-height:27px;color:#51657b;overflow-wrap:anywhere;word-break:break-word;">@@CONTENT@@</div>
@@ACTION@@
@@FALLBACK@@
<div class="notice" style="margin:28px 0 0;padding:16px 18px;background:@@SOFT@@;border-left:3px solid @@ACCENT@@;border-radius:0 8px 8px 0;"><p class="muted" style="margin:0;font-size:13px;line-height:22px;color:#51657b;">@@NOTE@@</p></div>
</td></tr>
<tr><td class="footer rule" style="padding:24px 40px 28px;border-top:1px solid #d7e1eb;border-radius:0 0 15px 15px;">
<p class="muted" style="margin:0 0 14px;font-size:11px;line-height:18px;color:#51657b;">@@FOOTER@@</p>
<p class="muted" style="margin:0 0 8px;font-size:12px;line-height:20px;color:#51657b;"><strong>Onesa UG (haftungsbeschränkt)</strong><br>Steinhofweg 47, 69123 Heidelberg, Germany<br>Geschäftsführer / Managing Director: Andrew Gotora<br>Amtsgericht Mannheim, HRB 757830</p>
<p class="muted" style="margin:0;font-size:12px;line-height:20px;color:#51657b;"><a class="url" href="mailto:info@onesa.eu" style="color:#087d92;text-decoration:underline;">info@onesa.eu</a> &nbsp;&middot;&nbsp; +49 151 474 16152</p>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const paragraphs = (value: string) => value.split(/\n\s*\n/).filter(p => p.trim()).map(p => `<p style="margin:0 0 18px;">${escapeHtml(p).replaceAll("\n", "<br>")}</p>`).join("");
function webOrigin(value: string): string | undefined {
  try { const u = new URL(value); return (u.protocol === "https:" || (u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname))) && !u.username && !u.password ? u.origin : undefined; }
  catch { return undefined; }
}
function button(href: string | undefined, label: string, accent: string) {
  return href ? `<table role="presentation" style="margin:28px 0 8px;"><tr><td class="button" bgcolor="${accent}" style="background:${accent};border-radius:8px;mso-padding-alt:16px 24px;"><a class="button-label" href="${escapeHtml(href)}" style="display:inline-block;padding:16px 24px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;line-height:20px;border:1px solid ${accent};border-radius:8px;">${escapeHtml(label)} &nbsp;&#8594;</a></td></tr></table>` : "";
}
function fill(values: Record<string, string>): string {
  return shell.replace(/@@([A-Z]+)@@/g, (_, key: string) => values[key] ?? "");
}

export function renderEmail(title: string, body: string, options: { resetUrl?: string; webUrl?: string } = {}): string {
  const origin = webOrigin(options.webUrl ?? process.env.PASSWORD_RESET_BASE_URL ?? (process.env.NODE_ENV !== "production" ? options.resetUrl : undefined) ?? "https://logistics.onesa.eu");
  const reset = options.resetUrl !== undefined;
  let action: string | undefined;
  if (reset && origin) {
    try {
      const u = new URL(options.resetUrl!);
      const query = new URLSearchParams(u.hash.split("?")[1]);
      if (u.origin === origin && !u.username && !u.password && u.pathname === "/" && !u.search &&
          u.hash.startsWith("#/reset-password?") && query.size === 1 && /^[A-Za-z0-9._-]{20,4096}$/.test(query.get("token") ?? "")) action = u.href;
    } catch { /* Malformed links remain escaped text, never actions. */ }
  } else if (!reset && origin) action = origin + "/#/insights/recommendations";
  const copy = action && reset ? body.split("\n").filter(line => line.trim() !== options.resetUrl).join("\n") : body;
  return fill({ LANG: "en", TITLE: escapeHtml(title), PREHEADER: reset ? "A secure link to choose a new Smart Logistics password." : escapeHtml(title),
    BRAND: "Smart Logistics", MONOGRAM: "SL", ACCENT: "#087d92", SOFT: "#eaf0f6", LABEL: reset ? "ACCOUNT SECURITY" : "WORKSPACE UPDATE",
    HEADING: reset ? "Reset your password" : escapeHtml(title), CONTENT: paragraphs(copy),
    ACTION: button(action, reset ? "Reset password" : "Open Smart Logistics", "#087d92"),
    FALLBACK: action && reset ? `<p class="muted" style="font-size:12px;line-height:20px;margin:24px 0 0;">If the button does not open, copy this link into your browser:</p><p style="font-size:11px;line-height:18px;margin:8px 0 0;word-break:break-all;"><a class="url" href="${escapeHtml(action)}" style="color:#087d92;">${escapeHtml(action)}</a></p>` : "",
    NOTE: reset ? "Keep this link private. Smart Logistics will never ask you to share your password or recovery link." : "Open your workspace to review the latest records and activity. A notification does not confirm shipment delivery.",
    FOOTER: "Automated message from your logistics workspace.",
  });
}
