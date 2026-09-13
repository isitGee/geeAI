/**
 * Development self-test provider.
 *
 * Disabled unless `AI_PROVIDER=echo`. It exists so the full path — request
 * validation, SSE streaming, client abort, markdown rendering — can be
 * exercised without an API key or network access. It is not an AI model and
 * it never runs in production unless you explicitly opt in.
 */

const SCRIPT = [
  'Self-test reply from GeeAI.\n\n',
  'This response comes from the **echo provider**, so you can verify the plumbing — streaming, cancellation, markdown and code rendering — without an AI provider key.\n\n',
  'You sent:\n\n',
  '```text\n',
  '"{{prompt}}"\n',
  '```\n\n',
  'Steps that are now wired up:\n\n',
  '1. `/api/chat` received the request\n',
  '2. the payload passed validation\n',
  '3. this reply is being streamed frame by frame\n',
  '4. the client renders it as Markdown\n\n',
  'Set `AI_PROVIDER=gemini` and add `GEMINI_API_KEY` to talk to a real model.',
];

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      },
      { once: true },
    );
  });
}

export const echoProvider = {
  name: 'echo',
  label: 'Echo (development self-test)',

  defaultModel: () => 'echo',
  models: () => ['echo'],
  isConfigured: () => true,

  async *stream({ messages, signal }) {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    const prompt = (lastUserMessage?.content || '').slice(0, 300);

    for (const line of SCRIPT) {
      await delay(90, signal);
      yield line.replace('{{prompt}}', prompt);
    }
  },
};
