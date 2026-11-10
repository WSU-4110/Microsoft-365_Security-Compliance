import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../api";
import { useApp } from "../hooks";

// Starts a scan job and polls it until it finishes. onDone(job) runs after completion.
export function useScanJob(onDone) {
  const { token, handleError } = useApp();
  const [job, setJob] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  const watch = (id) => {
    clearInterval(timer.current);
    timer.current = setInterval(async () => {
      try {
        const current = await apiFetch(`/api/jobs/${id}`, { token });
        setJob(current);
        if (current.status !== "running") {
          clearInterval(timer.current);
          if (current.status === "failed") handleError(new Error(`The scan failed: ${current.error}`));
          else if (onDone) await onDone(current);
          setJob(null);
        }
      } catch (err) {
        clearInterval(timer.current);
        setJob(null);
        handleError(err);
      }
    }, 600);
  };

  const start = async (path) => {
    try {
      const started = await apiFetch(path, { method: "POST", token });
      setJob(started);
      watch(started.id);
    } catch (err) {
      handleError(err);
    }
  };

  return { job, start };
}
