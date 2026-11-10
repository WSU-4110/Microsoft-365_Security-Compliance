import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { apiFetch } from "./api";

// Shared app state passed down from Layout: token, role, current client, error handling
export function useApp() {
  return useOutletContext();
}

// Loads a backend path and reloads it when the path changes.
// Data is stored with the path it came from, so switching clients never shows stale data.
export function useApi(path) {
  const { token, handleError } = useApp();
  const [state, setState] = useState({ path: null, data: null });

  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const data = await apiFetch(path, { token });
      setState({ path, data });
    } catch (err) {
      setState({ path, data: null });
      if (err.status !== 404) handleError(err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, token]);

  // Initial load: the result arrives in a callback, and is ignored if the path changed meanwhile
  useEffect(() => {
    if (!path) return undefined;
    let cancelled = false;
    apiFetch(path, { token })
      .then((data) => { if (!cancelled) setState({ path, data }); })
      .catch((err) => {
        if (cancelled) return;
        setState({ path, data: null });
        if (err.status !== 404) handleError(err);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, token]);

  const current = state.path === path;
  const setData = (data) => setState({ path, data });
  return { data: current ? state.data : null, loading: !current, reload, setData };
}
