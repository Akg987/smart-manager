import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  SmsIppanelHubRepository,
  SmsTestDailyLimitExceeded,
} from "./sms-ippanel-hub.repository.js";
import {
  decryptLaravelValue,
  encryptLaravelValue,
} from "../../shared/laravel-crypto.js";

const creditEndpoint =
  "https://api2.ippanel.com/api/v1/sms/accounting/credit/show";
const identityEndpoint = "https://edge.ippanel.com/v1/api/acl/auth/check_token";
const sendEndpoint = "https://edge.ippanel.com/v1/api/send";

@Injectable()
export class SmsIppanelHubService {
  constructor(private readonly repository: SmsIppanelHubRepository) {}
  private creditCache: { expiresAt: number; value: number } | null = null;

  static maskApiKey(apiKey: string): string {
    if (!apiKey) return "";
    if (apiKey.length <= 8) return "•".repeat(apiKey.length);
    return `${apiKey.slice(0, 4)}${"•".repeat(Math.max(4, apiKey.length - 8))}${apiKey.slice(-4)}`;
  }

  static resolveCreditThreshold(
    credit: number,
    high = 500_000,
    critical = 100_000,
    step = 50_000,
  ): number | "critical" | null {
    if (credit > high) return null;
    if (credit < critical) return "critical";
    if (step <= 0)
      throw new RangeError("Credit threshold step must be positive.");
    let active: number | null = null;
    for (let level = high; level >= critical; level -= step)
      if (credit <= level) active = level;
    return active;
  }

  static normalizePhone(phone: string): string {
    const latin = phone
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
    let digits = latin.replace(/\D/g, "");
    if (digits.length === 10 && digits.startsWith("9")) digits = `98${digits}`;
    else if (digits.length === 11 && digits.startsWith("09"))
      digits = `98${digits.slice(1)}`;
    return digits.length >= 12 && digits.startsWith("98") ? `+${digits}` : "";
  }

  static normalizeSender(sender: string): string {
    let value = sender
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
    value = value
      .replace(/[\u200b-\u200d\ufeff\u00a0]/g, "")
      .replace(/[^0-9+]/g, "")
      .replace(/^\++/, "");
    if (!value || value.startsWith("09")) return "";
    if (!value.startsWith("98") && /^(1000|2000|3000|5000|9000)/.test(value))
      value = `98${value}`;
    return `+${value}`;
  }

  static normalizePatternCode(code: string): string {
    const value = code
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .replace(/[\u200b-\u200d\ufeff\u00a0]/g, "")
      .trim()
      .replace(/^['"`]+|['"`]+$/g, "");
    return value.replace(/^(?:code|pattern|کد\s*پترن)\s*[:=]\s*/i, "").trim();
  }

  async configured(): Promise<boolean> {
    const settings = await this.currentSettings();
    return Boolean(settings?.apiKey?.trim() && settings.sender?.trim());
  }

  async saveSettings(apiKey: string, sender: string) {
    const normalizedSender = SmsIppanelHubService.normalizeSender(sender);
    if (!normalizedSender)
      throw new BadRequestException("Invalid IPPanel sender number.");
    const suppliedKey = apiKey.trim();
    const encryptedKey = suppliedKey
      ? encryptLaravelValue(suppliedKey, this.applicationKey())
      : undefined;
    const settings = await this.repository.saveSettings(
      normalizedSender,
      encryptedKey,
    );
    this.creditCache = null;
    return {
      id: settings.id,
      sender: settings.sender,
      configured: Boolean(settings.apiKey),
    };
  }

  async sendPattern(
    patternCode: string,
    mobile: string,
    params: Record<string, string | number | boolean | null> = {},
  ): Promise<void> {
    const settings = await this.currentSettings();
    const pattern = SmsIppanelHubService.normalizePatternCode(patternCode);
    const recipient = SmsIppanelHubService.normalizePhone(mobile);
    const sender = SmsIppanelHubService.normalizeSender(settings?.sender ?? "");
    const apiKey = settings?.apiKey ? this.decryptApiKey(settings.apiKey) : "";
    if (!apiKey || !sender || !pattern)
      throw new ServiceUnavailableException("IPPanel is not configured.");
    if (!recipient) throw new BadRequestException("Invalid mobile number.");
    const cleanParams: Record<string, string> = {};
    for (const [rawKey, rawValue] of Object.entries(params)) {
      const key = rawKey.replace(/[^a-zA-Z0-9_-]/g, "");
      if (key)
        cleanParams[key] =
          rawValue === null
            ? ""
            : typeof rawValue === "boolean"
              ? rawValue
                ? "1"
                : "0"
              : String(rawValue);
    }
    const body = {
      sending_type: "pattern",
      from_number: sender,
      code: pattern,
      recipients: [recipient],
      params: cleanParams,
    };
    let response: Response;
    try {
      response = await fetch(sendEndpoint, {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new ServiceUnavailableException("Could not connect to IPPanel.");
    }
    const data = await this.responseJson(response);
    const meta = this.object(this.object(data)?.meta);
    if (response.ok && Boolean(meta?.status)) return;
    throw new HttpException(
      typeof meta?.message === "string"
        ? meta.message
        : `IPPanel rejected the request (HTTP ${response.status}).`,
      response.status >= 400 && response.status < 600
        ? response.status
        : HttpStatus.BAD_GATEWAY,
    );
  }

  async sendOtp(
    patternCode: string,
    mobile: string,
    code: string,
  ): Promise<void> {
    if (!/^\d{6}$/.test(code))
      throw new BadRequestException("OTP code must contain six digits.");
    await this.sendPattern(patternCode, mobile, { code });
  }

  async fetchCredit(): Promise<number> {
    if (this.creditCache && this.creditCache.expiresAt > Date.now())
      return this.creditCache.value;
    const apiKey = this.getApiKey(await this.currentSettings());
    const response = await this.request(creditEndpoint, {
      method: "GET",
      headers: {
        Apikey: apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    const data = await this.responseJson(response);
    const nested = this.object(this.object(data)?.data);
    const credit = nested?.credit ?? this.object(data)?.credit;
    if (typeof credit !== "number" && typeof credit !== "string")
      throw new ServiceUnavailableException(
        "IPPanel response did not include account credit.",
      );
    const value = Number(credit);
    if (!Number.isFinite(value))
      throw new ServiceUnavailableException(
        "IPPanel returned an invalid credit value.",
      );
    this.creditCache = { value, expiresAt: Date.now() + 300_000 };
    return value;
  }

  async fetchAccountIdentity(): Promise<{
    user_name: string;
    name: string;
  } | null> {
    try {
      const apiKey = this.getApiKey(await this.currentSettings());
      const response = await this.request(identityEndpoint, {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: "{}",
      });
      const data = this.object(await this.responseJson(response));
      const payload = this.object(data?.data);
      if (!response.ok || !payload) return null;
      return {
        user_name: String(payload.user_name ?? ""),
        name: String(payload.name ?? ""),
      };
    } catch {
      return null;
    }
  }

  async shouldAlertLowCredit(userId: bigint): Promise<{
    credit: number;
    threshold: number | "critical";
    formatted: string;
  } | null> {
    let credit: number;
    try {
      credit = await this.fetchCredit();
    } catch {
      return null;
    }
    const threshold = SmsIppanelHubService.resolveCreditThreshold(credit);
    if (threshold === null) {
      await this.repository.deleteCreditAlert(userId);
      return null;
    }
    if (threshold !== "critical") {
      const current = await this.repository.findCreditAlert(userId);
      if (current?.threshold === String(threshold)) return null;
      await this.repository.upsertCreditAlert(userId, String(threshold));
    }
    return { credit, threshold, formatted: String(Math.round(credit)) };
  }

  /** Call after IPPanel accepts a test send; unsuccessful provider attempts do not consume quota. */
  async recordAcceptedTestSend(day: string, dailyLimit: number) {
    try {
      return await this.repository.recordAcceptedTestSend(day, dailyLimit);
    } catch (error) {
      if (error instanceof SmsTestDailyLimitExceeded)
        throw new HttpException(
          "Daily test SMS quota reached.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      throw error;
    }
  }

  private async currentSettings() {
    return this.repository.findSettings();
  }

  private getApiKey(settings: { apiKey: string | null } | null) {
    if (!settings?.apiKey)
      throw new ServiceUnavailableException(
        "IPPanel API key is not configured.",
      );
    return this.decryptApiKey(settings.apiKey);
  }

  private decryptApiKey(value: string) {
    try {
      return decryptLaravelValue(value, this.applicationKey());
    } catch {
      throw new ServiceUnavailableException(
        "Could not decrypt the stored IPPanel API key. Verify APP_KEY compatibility.",
      );
    }
  }

  private applicationKey() {
    const key = process.env.APP_KEY;
    if (!key)
      throw new ServiceUnavailableException(
        "APP_KEY is required for IPPanel credential encryption.",
      );
    return key;
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok)
        throw new ServiceUnavailableException(
          `IPPanel request failed (HTTP ${response.status}).`,
        );
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException("Could not connect to IPPanel.");
    }
  }

  private async responseJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new ServiceUnavailableException("IPPanel returned invalid JSON.");
    }
  }

  private object(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
}
