import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type Transporter from 'nodemailer/lib/mailer';
import {
  buildOtpEmailHtml,
  buildOtpEmailText,
  type OtpEmailKind,
} from './otp-email.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  async sendOtpEmail(
    to: string,
    subject: string,
    code: string,
    kind: OtpEmailKind,
  ): Promise<void> {
    const expiresMinutes = Number(
      this.config.get<string>('OTP_EXPIRES_MINUTES') ?? 15,
    );
    const text = buildOtpEmailText(code, kind, expiresMinutes);
    const html = buildOtpEmailHtml(code, kind, expiresMinutes);

    await this.sendMail(to, subject, text, html, code);
  }

  private async sendMail(
    to: string,
    subject: string,
    text: string,
    html: string,
    devCode?: string,
  ): Promise<void> {
    const host = this.config.get<string>('MAIL_HOST')?.trim();
    if (!host) {
      this.logger.warn(
        `[mail] SMTP desligado (MAIL_HOST vazio). Código OTP para ${to}: ${devCode ?? '(n/a)'}`,
      );
      return;
    }

    const transporter = this.getTransporter();
    const from =
      this.config.get<string>('MAIL_FROM')?.trim() ??
      'Really Meet <noreply@localhost>';

    try {
      await transporter.sendMail({ from, to, subject, text, html });
      this.logger.log(`[mail] OTP enviado para ${to}`);
    } catch (error) {
      this.logger.error(`[mail] Falha SMTP ao enviar para ${to}`, error);
      throw new BadRequestException(
        'Não foi possível enviar o e-mail. Verifique SMTP ou tente mais tarde.',
      );
    }
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.config.getOrThrow<string>('MAIL_HOST');
    const port = Number(this.config.get('MAIL_PORT') ?? 587);
    const secure =
      this.config.get<string>('MAIL_SECURE') === '1' ||
      this.config.get<string>('MAIL_SECURE') === 'true';
    const user = this.config.get<string>('MAIL_USER')?.trim();
    const pass = this.config.get<string>('MAIL_PASS');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });

    return this.transporter;
  }
}
