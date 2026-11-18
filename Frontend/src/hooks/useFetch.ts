import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../utils/errors';

// Minimal data-fetching hook: refetches when `deps` change; `reload()` forces a refetch.
// Ignores results from superseded requests (e.g. fast typing in a search box).
export default function useFetch(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((e) => active && setState((s) => ({ ...s, loading: false, error: getErrorMessage(e) })));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
