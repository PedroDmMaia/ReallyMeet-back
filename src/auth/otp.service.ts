import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose } from '@prisma/client';
import { createHash, randomInt } from 'crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async sendRegistrationCode(
    email: string,
  ): Promise<{ expiresInMinutes: number; devCode?: string }> {
    return this.issueCode(
      email,
      OtpPurpose.REGISTER,
      'Confirme seu cadastro — Really Meet',
      'register',
    );
  }

  async sendPasswordResetCode(
    email: string,
  ): Promise<{ expiresInMinutes: number; devCode?: string }> {
    return this.issueCode(
      email,
      OtpPurpose.PASSWORD_RESET,
      'Recuperação de senha — Really Meet',
      'password_reset',
    );
  }

  async verifyRegistrationCode(email: string, code: string): Promise<void> {
    await this.verifyCode(email, OtpPurpose.REGISTER, code);
  }

  async verifyPasswordResetCode(email: string, code: string): Promise<void> {
    await this.verifyCode(email, OtpPurpose.PASSWORD_RESET, code);
  }

  private async issueCode(
    rawEmail: string,
    purpose: OtpPurpose,
    subject: string,
    emailKind: 'register' | 'password_reset',
  ): Promise<{ expiresInMinutes: number; devCode?: string }> {
    const email = this.normalizeEmail(rawEmail);
    const expiresInMinutes = Number(
      this.config.get<string>('OTP_EXPIRES_MINUTES') ?? 15,
    );
    const minResendSeconds = Number(
      this.config.get<string>('OTP_MIN_RESEND_SECONDS') ?? 60,
    );

    const recent = await this.prisma.emailOtp.findFirst({
      where: {
        email,
        purpose,
        usedAt: null,
        createdAt: { gt: new Date(Date.now() - minResendSeconds * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      throw new HttpException(
        `Aguarde ${minResendSeconds}s antes de solicitar outro código.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.prisma.emailOtp.updateMany({
      where: { email, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });

    const code = String(randomInt(100_000, 1_000_000));
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await this.prisma.emailOtp.create({
      data: {
        email,
        purpose,
        codeHash: this.hashCode(email, purpose, code),
        expiresAt,
      },
    });

    await this.mail.sendOtpEmail(email, subject, code, emailKind);

    const exposeDevCode =
      this.config.get<string>('MAIL_DEV_RETURN_CODE') === '1';

    return {
      expiresInMinutes,
      ...(exposeDevCode ? { devCode: code } : {}),
    };
  }

  private async verifyCode(
    rawEmail: string,
    purpose: OtpPurpose,
    code: string,
  ): Promise<void> {
    const email = this.normalizeEmail(rawEmail);
    const normalizedCode = code.trim();
    if (!/^\d{6}$/.test(normalizedCode)) {
      throw new BadRequestException('Código inválido.');
    }

    const otp = await this.prisma.emailOtp.findFirst({
      where: {
        email,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new BadRequestException('Código expirado ou inexistente.');
    }

    const expected = this.hashCode(email, purpose, normalizedCode);
    if (otp.codeHash !== expected) {
      throw new BadRequestException('Código incorreto.');
    }

    await this.prisma.emailOtp.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    });
  }

  private hashCode(email: string, purpose: OtpPurpose, code: string): string {
    return createHash('sha256')
      .update(`${email}:${purpose}:${code}`)
      .digest('hex');
  }
}
