import { ApiError } from '../errors.js';
import { geminiProvider } from './gemini.js';
import { echoProvider } from './echo.js';

/**
 * Provider registry.
 *
 * Adding a provider means implementing `stream()` (an async generator of text
 * deltas) plus the three metadata helpers, then registering it here and
 * setting `AI_PROVIDER`.
 */
const PROVIDERS = {
  gemini: geminiProvider,
  echo: echoProvider,
};

export function getProvider(config) {
  const provider = PROVIDERS[config.provider];
  if (!provider) {
    console.error(`[geeai] unknown AI_PROVIDER "${config.provider}"`);
    throw new ApiError('provider_not_configured', { status: 503 });
  }
  return provider;
}

export function providerInfo(config) {
  const provider = getProvider(config);
  const models = provider.models(config) || [];
  const defaultModel = provider.defaultModel(config);
  return {
    name: provider.name,
    label: provider.label,
    configured: Boolean(provider.isConfigured(config)),
    defaultModel,
    models: models.includes(defaultModel) ? models : [defaultModel, ...models],
  };
}
