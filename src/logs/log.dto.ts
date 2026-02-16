export class CreateLogDto {
  timestamp?: string;
  source?: string;
  severity?: string;
  event?: string;
  user?: string;
  ip?: string;
  latitude?: number | string;
  longitude?: number | string;
  lat?: number | string;
  lon?: number | string;
  // Raw line payload keys commonly used by Nginx/Syslog forwarders
  message?: string;
  log?: string;
  line?: string;
  rawLine?: string;
  // Anything else sent by clients should be captured for normalization
  [key: string]: unknown;
}
