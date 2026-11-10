import { useEffect, useRef, useState } from "react";

// Confirms an action against a client tenant. Asks for a reason (saved in the activity log)
// and, for destructive actions, for the target's name to be typed.
// action: { title, description, confirmLabel, danger, typeToConfirm }
export default function ActionDialog({ action, onConfirm, onCancel, busy }) {
  const ref = useRef(null);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    if (action && !dialog.open) {
      setReason("");
      setTyped("");
      dialog.showModal();
    } else if (!action && dialog.open) {
      dialog.close();
    }
  }, [action]);

  const ready = reason.trim().length >= 5 && (!action?.typeToConfirm || typed === action.typeToConfirm);

  return (
    <dialog ref={ref} className="dialog" onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }}>
      {action && (
        <form onSubmit={(e) => { e.preventDefault(); if (ready) onConfirm({ reason: reason.trim(), confirmName: typed }); }}>
          <h2>{action.title}</h2>
          <p className="dialog-text">{action.description}</p>
          <label htmlFor="dialog-reason">Reason (saved in the activity log)</label>
          <textarea id="dialog-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
            placeholder="For example: ticket #4821, user reported a lost phone" />
          {action.typeToConfirm && (
            <>
              <label htmlFor="dialog-confirm">Type <strong>{action.typeToConfirm}</strong> to confirm</label>
              <input id="dialog-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </>
          )}
          <div className="dialog-buttons">
            <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="submit" className={action.danger ? "btn btn-danger" : "btn btn-primary"} disabled={busy || !ready}>
              {busy ? "Sending..." : action.confirmLabel}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
