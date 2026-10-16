export type OtpEmailKind = 'register' | 'password_reset';

const COPY: Record<
  OtpEmailKind,
  { title: string; lead: string; footer: string }
> = {
  register: {
    title: 'Confirme seu cadastro',
    lead: 'Use o código abaixo para concluir a criação da sua conta no Really Meet.',
    footer: 'Se você não está se cadastrando, ignore este e-mail.',
  },
  password_reset: {
    title: 'Recuperação de senha',
    lead: 'Use o código abaixo para definir uma nova senha no Really Meet.',
    footer: 'Se você não pediu recuperação de senha, ignore este e-mail.',
  },
};

export function buildOtpEmailText(
  code: string,
  kind: OtpEmailKind,
  expiresMinutes: number,
): string {
  const copy = COPY[kind];
  return [
    'Really Meet',
    '',
    copy.title,
    '',
    copy.lead,
    '',
    `Código: ${code}`,
    '',
    `Válido por ${expiresMinutes} minutos.`,
    '',
    copy.footer,
  ].join('\n');
}

export function buildOtpEmailHtml(
  code: string,
  kind: OtpEmailKind,
  expiresMinutes: number,
): string {
  const copy = COPY[kind];
  const digits = code.split('').map(
    (digit) =>
      `<td style="width:44px;height:52px;text-align:center;vertical-align:middle;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;color:#ffffff;background-color:#2f2f4a;border:1px solid #5b5fc7;border-radius:8px;">${digit}</td>`,
  );

  const digitRow = digits.join(
    '<td style="width:8px;font-size:0;line-height:0;">&nbsp;</td>',
  );

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>Really Meet — ${copy.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f0f;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Seu código Really Meet: ${code} (válido por ${expiresMinutes} min)
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0f0f0f;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;background-color:#1f1f1f;border:1px solid #3d3d3d;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 20px;background:linear-gradient(135deg,#444791 0%,#5b5fc7 50%,#2f2f4a 100%);">
              <p style="margin:0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#e8e9ff;">Really Meet</p>
              <h1 style="margin:10px 0 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:24px;font-weight:700;line-height:1.25;color:#ffffff;">${copy.title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#adadad;">${copy.lead}</p>
              <p style="margin:0 0 12px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#8a8a8a;">Seu código</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 20px;">
                <tr>${digitRow}</tr>
              </table>
              <p style="margin:0 0 8px;text-align:center;font-family:ui-monospace,'Cascadia Code','Segoe UI Mono',monospace;font-size:14px;letter-spacing:0.35em;color:#7f85f5;">${code}</p>
              <p style="margin:0;text-align:center;font-size:13px;color:#8a8a8a;">Expira em <strong style="color:#ffffff;">${expiresMinutes} minutos</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 28px;border-top:1px solid #2b2b2b;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#8a8a8a;">${copy.footer}</p>
              <p style="margin:12px 0 0;font-size:11px;color:#666666;">© ${new Date().getFullYear()} Really Meet</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
