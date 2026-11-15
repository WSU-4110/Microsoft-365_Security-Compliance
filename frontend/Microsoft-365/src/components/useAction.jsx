import { useState } from "react";
import { apiFetch } from "../api";
import { useApp } from "../hooks";
import ActionDialog from "./ActionDialog";

// Shared flow for any action sent to a tenant: confirm dialog, request, success notice.
// ask({ title, description, confirmLabel, danger, typeToConfirm, path, method, body })
export function useAction(onDone) {
  const { token, handleError } = useApp();
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const ask = (config) => {
    setNotice("");
    setPending(config);
  };

  const confirm = async ({ reason, confirmName }) => {
    const config = pending;
    setBusy(true);
    try {
      const result = await apiFetch(config.path, {
        method: config.method || "POST",
        token,
        body: { ...(config.body || {}), reason, confirmName },
      });
      setNotice(result.message || config.doneMessage || "Done.");
      setPending(null);
      if (onDone) await onDone(result, config);
    } catch (err) {
      setPending(null);
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const dialog = <ActionDialog action={pending} busy={busy} onConfirm={confirm} onCancel={() => setPending(null)} />;
  return { ask, dialog, notice, setNotice };
}
