import * as assert from 'node:assert/strict';
import { NginxLogParser } from './nginx-log.parser';
import { SyslogLogParser } from './syslog-log.parser';
import { CreateLogDto } from '../log.dto';

function run(name: string, fn: () => void): void {
  try {
    fn();
    // Keep output concise but visible in CI/local runs.
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run('Nginx parser parses combined access log line', () => {
  const parser = new NginxLogParser();
  const dto: CreateLogDto = {
    latitude: 37.7749,
    longitude: -122.4194,
    message:
      '127.0.0.1 - - [10/Oct/2000:13:55:36 -0700] "GET /login HTTP/1.1" 401 2326 "https://example.com" "Mozilla/5.0"',
  };

  assert.equal(parser.canParse(dto), true);
  const logs = parser.parse(dto);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].source, 'nginx');
  assert.equal(logs[0].event, 'nginx_access_4xx');
  assert.equal(logs[0].severity, 'medium');
  assert.equal(logs[0].ip, '127.0.0.1');
  assert.equal(logs[0].latitude, 37.7749);
  assert.equal(logs[0].longitude, -122.4194);
});

run('Nginx parser maps 5xx status code to high severity', () => {
  const parser = new NginxLogParser();
  const dto: CreateLogDto = {
    source: 'nginx',
    message: '10.10.10.10 - - [10/Oct/2000:13:55:36 -0700] "POST /api HTTP/1.1" 503 12 "-" "curl/8.0"',
  };

  const logs = parser.parse(dto);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].event, 'nginx_access_5xx');
  assert.equal(logs[0].severity, 'high');
});

run('Syslog parser parses RFC5424 line', () => {
  const parser = new SyslogLogParser();
  const dto: CreateLogDto = {
    lat: '40.7128',
    lon: '-74.0060',
    message:
      '<34>1 2026-02-16T14:48:00Z host app 123 ID47 [exampleSDID@32473 iut="3"] Login failed for user admin',
  };

  assert.equal(parser.canParse(dto), true);
  const logs = parser.parse(dto);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].source, 'syslog');
  assert.equal(logs[0].event, 'syslog_app');
  assert.equal(logs[0].severity, 'high');
  assert.equal(logs[0].latitude, 40.7128);
  assert.equal(logs[0].longitude, -74.006);
});

run('Syslog parser parses RFC3164 line and extracts host IP', () => {
  const parser = new SyslogLogParser();
  const dto: CreateLogDto = {
    message: '<13>Feb 16 14:48:00 192.168.1.10 sshd[101]: Failed password for invalid user root',
  };

  const logs = parser.parse(dto);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].source, 'syslog');
  assert.equal(logs[0].event, 'syslog_sshd');
  assert.equal(logs[0].severity, 'medium');
  assert.equal(logs[0].ip, '192.168.1.10');
});

console.log('All parser unit tests passed.');
