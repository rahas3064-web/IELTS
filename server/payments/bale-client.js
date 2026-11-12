// Bale bot HTTP API (https://tapi.bale.ai). The bot token stays in this closure:
// errors name the method and status only, never the request URL.
const API_ROOT = "https://tapi.bale.ai";

export class BaleApiError extends Error {
  /**
   * @param {string} method
   * @param {number} status
   */
  constructor(method, status) {
    super(`Bale request failed: ${method}`);
    this.name = "BaleApiError";
    this.method = method;
    this.status = status;
  }
}

/**
 * @param {{token: string, fetchImpl?: typeof fetch}} options
 */
export function createBaleClient({ token, fetchImpl = globalThis.fetch }) {
  if (!token) throw new Error("Bale bot token is not set");
  /** @type {AbortController|null} */
  let inflight = null;

  /**
   * @param {string} method
   * @param {Record<string, unknown>} [body]
   * @param {number} [timeoutMs]
   */
  async function call(method, body = {}, timeoutMs = 20_000) {
    const controller = new AbortController();
    inflight = controller;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${API_ROOT}/bot${token}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const json = await response.json().catch(() => null);
      if (!json || json.ok !== true) throw new BaleApiError(method, response.status);
      return json.result;
    } catch (error) {
      if (error instanceof BaleApiError || error?.name === "AbortError") throw error;
      throw new BaleApiError(method, 0);
    } finally {
      clearTimeout(timer);
      if (inflight === controller) inflight = null;
    }
  }

  return {
    call,
    abort() {
      inflight?.abort();
    },
    /** @param {{offset?: number, timeout?: number, limit?: number}} params */
    getUpdates(params) {
      const waitSec = Number(params?.timeout ?? 0);
      return call("getUpdates", params, (waitSec + 15) * 1000);
    },
    deleteWebhook: () => call("deleteWebhook", {}),
    /** @param {Record<string, unknown>} params */
    sendInvoice: (params) => call("sendInvoice", params),
    /** @param {string|number} chatId @param {string} text */
    sendMessage: (chatId, text) => call("sendMessage", { chat_id: chatId, text }),
    /** @param {{pre_checkout_query_id: string, ok: boolean, error_message?: string}} params */
    answerPreCheckoutQuery: (params) => call("answerPreCheckoutQuery", params),
    /** @param {string} transactionId */
    inquireTransaction: (transactionId) => call("inquireTransaction", { transaction_id: transactionId }),
  };
}
