// Long-polls Bale updates on the single app process. Webhook is cleared first:
// Bale delivers each update to only one of webhook or getUpdates.

/**
 * @param {{client: {getUpdates: Function, deleteWebhook: Function, abort: Function},
 *          handleUpdate: (update: any) => Promise<void>,
 *          reconcile?: () => Promise<void>,
 *          log?: {warn: Function, error: Function}}} options
 */
export function startBaleListener({ client, handleUpdate, reconcile, log = console }) {
  let stopped = false;

  const done = (async () => {
    try {
      await client.deleteWebhook();
    } catch {
      log.warn("[bale] could not clear the webhook; polling receives nothing while a webhook is set");
    }
    let offset = 0;
    while (!stopped) {
      let updates = [];
      try {
        const result = await client.getUpdates({ offset, timeout: 20, limit: 50 });
        updates = Array.isArray(result) ? result : [];
      } catch (error) {
        if (stopped || error?.name === "AbortError") break;
        log.error("[bale] getUpdates failed");
        await delay(2000);
        continue;
      }
      for (const update of updates) {
        if (stopped) break;
        try {
          await handleUpdate(update);
        } catch {
          log.error(`[bale] update failed id=${update?.update_id}`);
        }
        if (Number.isInteger(update?.update_id)) offset = update.update_id + 1;
      }
      if (stopped) break;
      try {
        await reconcile?.();
      } catch {
        log.error("[bale] reconcile failed");
      }
    }
  })();

  return {
    stop() {
      stopped = true;
      client.abort();
    },
    done,
  };
}

/** @param {number} ms */
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
