export class CreateLogDto {
  timestamp?: string;
  source?: string;
  severity?: string;
  event?: string;
  user?: string;
  ip?: string;
  // Anything else sent by clients should be captured for normalization
  [key: string]: unknown;
}
