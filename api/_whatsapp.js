const https = require('https');

const GRAPH_API_VERSION = 'v21.0';

function getConfig() {
  return {
    phoneNumberId: process.env.WA_PHONE_NUMBER_ID || '',
    accessToken: process.env.WA_ACCESS_TOKEN || '',
  };
}

function isConfigured() {
  const cfg = getConfig();
  return !!(cfg.phoneNumberId && cfg.accessToken);
}

function formatPhone(number) {
  const cleaned = String(number).replace(/[^0-9]/g, '');
  if (cleaned.startsWith('91') && cleaned.length === 12) return cleaned;
  if (cleaned.length === 10) return '91' + cleaned;
  return cleaned;
}

function callGraphAPI(phoneNumberId, accessToken, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: 'graph.facebook.com',
      path: `/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject({ status: res.statusCode, error: parsed.error || parsed });
          }
        } catch (e) {
          reject({ status: res.statusCode, error: body });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Send a pre-approved template message
 * @param {string} phone - 10-digit Indian mobile or 91XXXXXXXXXX
 * @param {string} templateName - e.g. 'payment_confirmed'
 * @param {string[]} params - template body parameters
 * @param {string} [lang='en'] - template language code
 */
async function sendTemplateMessage(phone, templateName, params, lang) {
  if (!isConfigured()) {
    console.warn('[WhatsApp] Not configured — skipping template send to', phone);
    return { skipped: true, reason: 'not_configured' };
  }

  const cfg = getConfig();
  const to = formatPhone(phone);

  const components = [];
  if (params && params.length) {
    components.push({
      type: 'body',
      parameters: params.map((p) => ({ type: 'text', text: String(p) })),
    });
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: lang || 'en' },
      components: components,
    },
  };

  try {
    const result = await callGraphAPI(cfg.phoneNumberId, cfg.accessToken, payload);
    console.log('[WhatsApp] Template sent to', to, ':', templateName);
    return { success: true, messageId: result.messages && result.messages[0] && result.messages[0].id };
  } catch (err) {
    console.error('[WhatsApp] Template send failed to', to, ':', err);
    return { success: false, error: err };
  }
}

/**
 * Send a freeform text message (only works within 24h conversation window)
 * @param {string} phone - 10-digit Indian mobile or 91XXXXXXXXXX
 * @param {string} text - message body
 */
async function sendTextMessage(phone, text) {
  if (!isConfigured()) {
    console.warn('[WhatsApp] Not configured — skipping text send to', phone);
    return { skipped: true, reason: 'not_configured' };
  }

  const cfg = getConfig();
  const to = formatPhone(phone);

  const payload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'text',
    text: { body: text },
  };

  try {
    const result = await callGraphAPI(cfg.phoneNumberId, cfg.accessToken, payload);
    console.log('[WhatsApp] Text sent to', to);
    return { success: true, messageId: result.messages && result.messages[0] && result.messages[0].id };
  } catch (err) {
    console.error('[WhatsApp] Text send failed to', to, ':', err);
    return { success: false, error: err };
  }
}

module.exports = { sendTemplateMessage, sendTextMessage, isConfigured, formatPhone };
