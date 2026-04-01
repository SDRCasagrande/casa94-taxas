import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export const FROM_EMAIL = 'BitTask <alertas@bkaiser.com.br>';

export async function sendRenegotiationAlert(
    to: string,
    clientName: string,
    daysLeft: number,
    userName: string
) {
    if (!resend) {
        console.warn('Resend not configured, skipping email');
        return null;
    }

    const isUrgent = daysLeft <= 0;
    const isWarning = daysLeft > 0 && daysLeft <= 3;

    const subject = isUrgent
        ? `🔴 HOJE: Renegociação do cliente ${clientName}`
        : `🟡 Faltam ${daysLeft} dia(s) — Renegociar ${clientName}`;

    const accentColor = isUrgent ? '#ef4444' : '#f59e0b';
    const iconEmoji = isUrgent ? '🚨' : '⏰';
    const statusText = isUrgent
        ? 'Vence Hoje!'
        : `Faltam ${daysLeft} dia(s)`;
    const statusBg = isUrgent ? '#7f1d1d' : '#78350f';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        
        <!-- Logo -->
        <tr><td align="center" style="padding-bottom:24px;">
          <div style="display:inline-block;background:#10b981;color:white;font-weight:900;font-size:20px;width:48px;height:48px;line-height:48px;text-align:center;border-radius:14px;">BK</div>
        </td></tr>

        <!-- Header -->
        <tr><td style="background:${accentColor};border-radius:16px 16px 0 0;padding:24px 32px;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">${iconEmoji}</div>
          <h1 style="margin:0;color:white;font-size:22px;font-weight:700;">Alerta de Renegociação</h1>
          <div style="display:inline-block;background:${statusBg};color:white;padding:6px 16px;border-radius:20px;font-size:14px;font-weight:600;margin-top:12px;">
            ${statusText}
          </div>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#1e293b;padding:32px;border-radius:0 0 16px 16px;">
          
          <p style="color:#e2e8f0;font-size:16px;margin:0 0 20px;line-height:1.5;">
            Olá <strong style="color:white;">${userName}</strong> 👋
          </p>

          <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:#94a3b8;font-size:13px;padding-bottom:8px;">Cliente</td>
              </tr>
              <tr>
                <td style="color:white;font-size:18px;font-weight:700;padding-bottom:16px;">${clientName}</td>
              </tr>
              <tr>
                <td style="color:#94a3b8;font-size:13px;padding-bottom:8px;">Status</td>
              </tr>
              <tr>
                <td>
                  ${isUrgent
            ? '<span style="color:#ef4444;font-size:16px;font-weight:700;">⚡ A renegociação vence HOJE! Entre em contato agora.</span>'
            : `<span style="color:#f59e0b;font-size:16px;font-weight:600;">⏳ A renegociação vence em <strong>${daysLeft} dia(s)</strong>. Prepare-se!</span>`
        }
                </td>
              </tr>
            </table>
          </div>

          ${isUrgent ? `
          <p style="color:#fca5a5;font-size:14px;margin:0 0 20px;line-height:1.5;background:#450a0a;padding:12px 16px;border-radius:8px;border:1px solid #7f1d1d;">
            ⚠️ Atenção: O prazo de 60 dias foi atingido. Contate o cliente o mais rápido possível para renovar as condições.
          </p>` : `
          <p style="color:#fde68a;font-size:14px;margin:0 0 20px;line-height:1.5;background:#451a03;padding:12px 16px;border-radius:8px;border:1px solid #78350f;">
            💡 Dica: Aproveite para preparar uma nova proposta com condições competitivas antes do vencimento.
          </p>`}

          <!-- CTA Button -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding-top:8px;">
              <a href="https://casa94.bkaiser.com.br/dashboard/negociacoes" 
                 style="display:inline-block;background:#10b981;color:white;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:700;">
                Acessar Negociações →
              </a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="color:#475569;font-size:12px;margin:0;">
            BitTask — Simulador premium de taxas de maquininhas
          </p>
          <p style="color:#334155;font-size:11px;margin:8px 0 0;">
            Você recebeu este email porque está cadastrado no sistema BitTask.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
        const result = await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject,
            html,
        });
        console.log(`Email sent to ${to} for client ${clientName}:`, result);
        return result;
    } catch (error) {
        console.error(`Failed to send email to ${to}:`, error);
        return null;
    }
}
