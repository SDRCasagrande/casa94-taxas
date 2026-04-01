import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resend, FROM_EMAIL } from '@/lib/resend';
import crypto from 'crypto';

// POST — request password reset (sends email with temporary password)
export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email?.trim()) {
            return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });

        // Always return success to prevent email enumeration
        if (!user || !user.isActive) {
            return NextResponse.json({ message: 'Se o email existir, uma nova senha será enviada.' });
        }

        const toEmail = user.notificationEmail || user.email;

        // Generate temporary password
        const tempPassword = crypto.randomBytes(4).toString('hex'); // 8 chars
        const bcrypt = await import('bcryptjs');
        const hashed = await bcrypt.hash(tempPassword, 12);

        // Update user password
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashed },
        });

        // Send email with new password
        if (resend) {
            await resend.emails.send({
                from: FROM_EMAIL,
                to: toEmail,
                subject: '🔒 Sua nova senha — BitTask',
                html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td align="center" style="padding-bottom:24px;">
          <div style="display:inline-block;background:#10b981;color:white;font-weight:900;font-size:20px;width:48px;height:48px;line-height:48px;text-align:center;border-radius:14px;">BK</div>
        </td></tr>
        <tr><td style="background:#3b82f6;border-radius:16px 16px 0 0;padding:24px 32px;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">🔒</div>
          <h1 style="margin:0;color:white;font-size:22px;font-weight:700;">Recuperação de Senha</h1>
        </td></tr>
        <tr><td style="background:#1e293b;padding:32px;border-radius:0 0 16px 16px;">
          <p style="color:#e2e8f0;font-size:16px;margin:0 0 20px;line-height:1.5;">
            Olá <strong style="color:white;">${user.name}</strong> 👋
          </p>
          <p style="color:#cbd5e1;font-size:14px;margin:0 0 16px;line-height:1.5;">
            Você solicitou a recuperação da sua senha. Aqui está sua nova senha temporária:
          </p>
          <div style="background:#0f172a;border:2px solid #3b82f6;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
            <p style="color:#94a3b8;font-size:12px;margin:0 0 8px;">SUA NOVA SENHA</p>
            <p style="color:#60a5fa;font-size:28px;font-weight:900;margin:0;letter-spacing:3px;font-family:monospace;">${tempPassword}</p>
          </div>
          <p style="color:#fde68a;font-size:13px;margin:0 0 20px;line-height:1.5;background:#451a03;padding:12px 16px;border-radius:8px;border:1px solid #78350f;">
            ⚠️ Recomendamos alterar esta senha assim que fizer login, em Configurações → Alterar Senha.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="https://casa94.bkaiser.com.br/login" 
                 style="display:inline-block;background:#3b82f6;color:white;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:700;">
                Fazer Login →
              </a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="color:#475569;font-size:12px;margin:0;">BitTask — Simulador premium de taxas</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
            });
        }

        return NextResponse.json({ message: 'Se o email existir, uma nova senha será enviada.' });
    } catch (error) {
        console.error('Password reset error:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
