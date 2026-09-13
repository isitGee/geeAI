/**
 * Errors that are safe to show a user.
 *
 * `ApiError` carries three separate things:
 *   - `status`  the HTTP status to return
 *   - `code`    a stable machine code the client can react to
 *   - `message` a short, human sentence with no secrets, stack traces or
 *               provider internals in it
 *
 * Anything worth debugging (raw provider bodies, keys hints, paths) is passed
 * as `detail` and only ever written to the server log.
 */

const MESSAGES = {
  invalid_json: 'That request could not be understood.',
  invalid_request: 'That request could not be understood.',
  payload_too_large: 'That message is too large for GeeAI to send.',
  conversation_too_long: 'This conversation is too long to continue. Start a new chat.',
  unknown_model: 'That model is not available on this GeeAI deployment.',
  rate_limited: 'You are sending messages too quickly. Please wait a moment.',
  provider_not_configured: 'GeeAI is not connected to an AI provider yet.',
  provider_unauthorized: 'GeeAI could not authenticate with the AI provider. Check the server configuration.',
  provider_rate_limited: 'The AI provider is rate limiting GeeAI right now. Please try again shortly.',
  provider_timeout: 'The AI provider took too long to respond.',
  provider_unavailable: 'GeeAI could not reach the AI provider.',
  provider_error: 'The AI provider returned an error.',
  response_blocked: 'The AI provider blocked that response for safety reasons.',
  empty_response: 'The AI returned an empty response. Try rephrasing your message.',
  internal_error: 'Something went wrong. Please try again.',
};

export class ApiError extends Error {
  constructor(code, { status = 500, message, detail } = {}) {
    super(message || MESSAGES[code] || MESSAGES.internal_error);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.detail = detail;
  }

  /** The only payload the browser ever sees. */
  toJSON() {
    return { error: { code: this.code, message: this.message } };
  }
}
