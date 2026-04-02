// BitTask Email Service via Resend

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'BitTask <noreply@bittask.com.br>';

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
    if (!RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not set, skipping email');
        return null;
    }

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
        });
        const data = await res.json();
        if (!res.ok) {
            console.error('Resend error:', data);
            return null;
        }
        return data;
    } catch (error) {
        console.error('Email send error:', error);
        return null;
    }
}

export function inviteEmailHtml(orgName: string, inviteLink: string, role: string) {
    const roleLabel = role === 'admin' ? 'Administrador' : 'Agente';
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; padding: 40px 16px;">
  <div style="max-width: 480px; margin: 0 auto; background: #1a1a1a; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #00A868, #00D084); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800;">BitTask</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px;">Convite para a Equipe</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 32px;">
      <p style="color: #e0e0e0; font-size: 15px; margin: 0 0 16px;">Você foi convidado para fazer parte da equipe:</p>
      
      <div style="background: rgba(0, 168, 104, 0.1); border: 1px solid rgba(0, 168, 104, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #00D084; font-weight: 700; font-size: 18px; margin: 0;">${orgName}</p>
        <p style="color: #888; font-size: 12px; margin: 4px 0 0;">Cargo: ${roleLabel}</p>
      </div>
      
      <p style="color: #999; font-size: 13px; margin: 0 0 24px;">Clique no botão abaixo para criar sua conta e começar a usar o BitTask.</p>
      
      <a href="${inviteLink}" style="display: block; background: linear-gradient(135deg, #00A868, #00D084); color: white; text-decoration: none; padding: 14px 24px; border-radius: 12px; text-align: center; font-weight: 700; font-size: 15px;">
        Aceitar Convite
      </a>
      
      <p style="color: #666; font-size: 11px; margin: 24px 0 0; text-align: center;">Este convite expira em 7 dias.</p>
    </div>
    
    <!-- Footer -->
    <div style="padding: 16px 32px; border-top: 1px solid rgba(255,255,255,0.05); text-align: center;">
      <p style="color: #555; font-size: 11px; margin: 0;">BitTask — Gestão de Tarefas em Equipe</p>
    </div>
  </div>
</body>
</html>`;
}
