export class CreateLogDto {
  timestamp?: string;
  source?: string;
  severity?: string;
  event?: string;
  user?: string;
  ip?: string;
  // Raw line payload keys commonly used by Nginx/Syslog forwarders
  message?: string;
  log?: string;
  line?: string;
  rawLine?: string;
  // Anything else sent by clients should be captured for normalization
  [key: string]: unknown;
}
