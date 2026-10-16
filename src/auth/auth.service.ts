import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CheckEmailDto } from './dto/check-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { OtpService } from './otp.service';
import { AuthUser, JwtPayload } from './types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly otp: OtpService,
  ) {}

  async checkEmailAndSendCode(dto: CheckEmailDto) {
    const email = this.otp.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { ok: false as const, reason: 'email_taken' as const };
    }

    const sent = await this.otp.sendRegistrationCode(email);
    return {
      ok: true as const,
      codeSent: true as const,
      expiresInMinutes: sent.expiresInMinutes,
      ...(sent.devCode ? { devCode: sent.devCode } : {}),
    };
  }

  async resendRegistrationCode(dto: CheckEmailDto) {
    return this.checkEmailAndSendCode(dto);
  }

  async register(dto: RegisterDto) {
    const email = this.otp.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }

    await this.otp.verifyRegistrationCode(email, dto.verificationCode);

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const now = new Date();
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: dto.displayName.trim(),
        emailVerifiedAt: now,
      },
      select: { id: true, email: true, displayName: true },
    });

    return this.issueTokens(user);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = this.otp.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    let devCode: string | undefined;
    if (user) {
      const sent = await this.otp.sendPasswordResetCode(email);
      devCode = sent.devCode;
    }
    return {
      message:
        'Se o e-mail estiver cadastrado, enviamos um código de recuperação.',
      ...(devCode ? { devCode } : {}),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = this.otp.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('Não foi possível redefinir a senha.');
    }

    await this.otp.verifyPasswordResetCode(email, dto.code);

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.issueTokens({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    });
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
      },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.user);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, createdAt: true },
    });
    if (!user) {
      throw new UnauthorizedException('Usuário inválido');
    }
    return user;
  }

  private async issueTokens(user: AuthUser) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      displayName: user.displayName,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as
        | `${number}m`
        | `${number}d`
        | `${number}s`,
    });

    const refreshToken = randomBytes(48).toString('hex');
    const refreshDays = this.parseDurationDays(
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    );
    const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDurationDays(value: string): number {
    const match = /^(\d+)([dhms])$/i.exec(value.trim());
    if (!match) {
      return 7;
    }
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 'd') return amount;
    if (unit === 'h') return amount / 24;
    if (unit === 'm') return amount / (24 * 60);
    return amount / (24 * 60 * 60);
  }
}
