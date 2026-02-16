export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface NormalizedLog {
  timestamp: Date;
  source: string;
  severity: Severity;
  event: string;
  user?: string;
  ip?: string;
  latitude?: number;
  longitude?: number;
  raw?: Record<string, unknown>;
}
