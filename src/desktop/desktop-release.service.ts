import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type DesktopRelease = {
  version: string;
  downloadUrl: string;
  sha256: string | null;
  notes: string;
  minimumVersion: string | null;
  publishedAt: string | null;
};

type GithubAsset = {
  name: string;
  browser_download_url: string;
  digest?: string | null;
};

type GithubRelease = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  body: string | null;
  published_at: string | null;
  assets: GithubAsset[];
};

const TAG_PREFIX = 'desktop-v';
const CACHE_TTL_MS = 5 * 60 * 1000;

export function compareVersions(a: string, b: string): number {
  const left = a.split(/[^0-9]+/).filter(Boolean).map(Number);
  const right = b.split(/[^0-9]+/).filter(Boolean).map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

@Injectable()
export class DesktopReleaseService {
  private readonly logger = new Logger(DesktopReleaseService.name);
  private cached: { at: number; release: DesktopRelease | null } | null = null;

  constructor(private readonly config: ConfigService) {}

  async latest(): Promise<DesktopRelease | null> {
    if (this.cached && Date.now() - this.cached.at < CACHE_TTL_MS) {
      return this.cached.release;
    }
    try {
      const release = await this.fetchLatest();
      this.cached = { at: Date.now(), release };
      return release;
    } catch (error) {
      this.logger.warn(`Falha ao consultar releases do desktop: ${String(error)}`);
      return this.cached?.release ?? null;
    }
  }

  private async fetchLatest(): Promise<DesktopRelease | null> {
    const repo =
      this.config.get<string>('DESKTOP_RELEASES_REPO')?.trim() ||
      'PedroDmMaia/ReallyMeet-back';
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'really-meet-api',
    };
    const token = this.config.get<string>('GITHUB_TOKEN')?.trim();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${repo}/releases?per_page=30`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(`GitHub respondeu ${response.status}`);
    }

    const releases = (await response.json()) as GithubRelease[];
    const candidates = releases
      .filter(
        (release) =>
          !release.draft &&
          !release.prerelease &&
          release.tag_name.startsWith(TAG_PREFIX) &&
          release.assets.some((asset) => asset.name.toLowerCase().endsWith('.msi')),
      )
      .sort((a, b) =>
        compareVersions(
          b.tag_name.slice(TAG_PREFIX.length),
          a.tag_name.slice(TAG_PREFIX.length),
        ),
      );

    const newest = candidates[0];
    if (!newest) {
      return null;
    }

    const msi = newest.assets.find((asset) =>
      asset.name.toLowerCase().endsWith('.msi'),
    )!;
    const body = newest.body ?? '';
    const sha256 =
      /<!--\s*sha256:([a-f0-9]{64})\s*-->/i.exec(body)?.[1]?.toLowerCase() ??
      msi.digest?.replace(/^sha256:/i, '').toLowerCase() ??
      null;
    const minimumVersion =
      /<!--\s*min-version:([0-9.]+)\s*-->/i.exec(body)?.[1] ?? null;

    return {
      version: newest.tag_name.slice(TAG_PREFIX.length),
      downloadUrl: msi.browser_download_url,
      sha256,
      notes: body.replace(/<!--[\s\S]*?-->/g, '').trim(),
      minimumVersion,
      publishedAt: newest.published_at,
    };
  }
}
