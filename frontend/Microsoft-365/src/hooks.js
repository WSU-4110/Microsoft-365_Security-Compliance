import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { apiFetch } from "./api";

/*
 * Returns shared application state provided by the Layout component.
 * This allows child pages to access values such as:
 * - authentication token
 * - current user role
 * - selected client
 * - error handling functions
 */
export function useApp() {
  return useOutletContext();
}

/*
 * Custom hook for loading data from an API endpoint.
 *
 * Features:
 * - Fetches data when the component loads
 * - Automatically refetches when the path changes
 * - Prevents stale data from being displayed
 * - Provides a reload function for manual refreshes
 */
export function useApi(path) {
  // Get shared app values from Layout
  const { token, handleError } = useApp();

  /*
   * state.path:
   *   Stores the endpoint the data came from
   *
   * state.data:
   *   Stores the response from that endpoint
   *
   * Keeping the path alongside the data helps prevent
   * displaying old data when users switch clients/pages.
   */
  const [state, setState] = useState({
    path: null,
    data: null,
  });

  /*
   * Reload function that can be called manually
   * to fetch fresh data from the backend.
   */
  const reload = useCallback(asy*c () => {
    // Do nothing if no *PI path was provided
    if (!path* return;

    try {
      // Reque*t data from the backend
      cons* data = await apiFetch(path, { tok*n });

      // Store the new data and the path it belongs to
      setState({ path, data });
    } catch (err) {
      // Clear data if the request fails
      setState({ path, data: null });

      // Ignore "not found" errors but report others
      if (err.status !== 404) {
        handleError(err);
      }
    }

    // Dependency warning intentionally suppressed
  }, [path, token]);

  /*
   * Automatically fetch data when:
   * - the component first loads
   * - the API path changes
   * - the user's token changes
   */
  useEffect(() => {
    if (!path) return undefined;

    /*
     * Prevents updating state if the component
     * unmounts before the request finishes.
     */
    let cancelled = false;

    *piFetch(path, { token })
      .th*n((data) => {
        // Only upda*e state if the component still exi*ts
        if (!cancelled) {
     *    setState({ path, data });
    *   }
      })
      .catch((err) => {
        if (cancelled) return;

        // Clear data when the request fails
        setState({ path, data: null });

        // Ignore 404 errors but report other errors
        if (err.status !== 404) {
          handleError(err);
        }
      });

    /*
     * Cleanup function.
     * Runs when the component unmounts or before
     * the effect runs again.
     */
    return () => {
      cancelled = true;
    };

    // Dependency warning intentionally suppressed
  }, [path, token]);

  /*
   * Determines whether the stored data belongs
   * to the currently requested API path.
   *
   * Prevents stale results from appearing if the user
   * quickly switches between pages or clients.
   */
  const current = state.path === path;

  /*
   * Helper function that allows components
   * to update the stored data manually.
   */
  const setData = (data) => setState({ path, data });

  // Return the values that components need
  return {
    // Return data only if it belongs to the current path
    data: current ? state.data : null,

    // Loading is true while waiting for current data
    loading: !current,

    // Function to manually reload data
    reload,

    // Function to manually update data
    setData,
  };
}
