import { useCallback, useEffect, useState } from "react";
import { loadDivisionData } from "../utils/storage";

export const useDivisionData = (divisionKey) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(
    async (force = false) => {
      if (!divisionKey) return;
      setLoading(true);
      try {
        const divisionData = await loadDivisionData(divisionKey, { force });
        setData(divisionData);
        setError(null);
      } catch (err) {
        console.error("Error cargando división", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [divisionKey]
  );

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  const refresh = useCallback(() => fetchData(true), [fetchData]);

  return { data, loading, error, refresh };
};
