export const RULE_ID_FAILED_LOGINS = 'failed-logins-5-in-5m';
export const RULE_ID_IMPOSSIBLE_TRAVELER = 'impossible-traveler';

export const FAILED_LOGIN_EVENT_NAMES = [
  'login_failed',
  'failed_login',
  'auth_failed',
  'auth_login_failed',
  'auth_login_failure',
];

export const LOGIN_SUCCESS_EVENT_NAMES = [
  'login_success',
  'auth_login_success',
  'user_login_success',
  'authentication_success',
];

export const IMPOSSIBLE_TRAVELER_MAX_LOOKBACK_HOURS = 24;
export const IMPOSSIBLE_TRAVELER_MIN_DISTANCE_KM = 500;
export const IMPOSSIBLE_TRAVELER_MIN_SPEED_KMH = 900;
