import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getObjects } from "../services/customService";
import { useAuthStore } from "../store/authStore";

const ObjectMetadataContext = createContext(null);

export function ObjectMetadataProvider({ children }) {
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const canLoadObjects = Boolean(token && user?.isAdmin);

  const refreshObjects = useCallback(async () => {
    if (!canLoadObjects) {
      setObjects([]);
      setLoading(false);
      setLoaded(false);
      setError(null);
      return [];
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getObjects();
      setObjects(data || []);
      setLoaded(true);
      return data || [];
    } catch (fetchError) {
      setError(fetchError);
      throw fetchError;
    } finally {
      setLoading(false);
    }
  }, [canLoadObjects]);

  useEffect(() => {
    if (!canLoadObjects) {
      setObjects([]);
      setLoading(false);
      setLoaded(false);
      setError(null);
      return;
    }

    refreshObjects().catch(() => {});
  }, [canLoadObjects, refreshObjects]);

  const objectMap = useMemo(() => {
    return new Map(objects.map((item) => [item.apiName, item]));
  }, [objects]);

  const value = useMemo(
    () => ({
      objects,
      loading,
      loaded,
      error,
      refreshObjects,
      getObjectByApiNameFromCache: (apiName) => objectMap.get(apiName) || null,
    }),
    [objects, loading, loaded, error, refreshObjects, objectMap]
  );

  return <ObjectMetadataContext.Provider value={value}>{children}</ObjectMetadataContext.Provider>;
}

export function useObjectMetadata() {
  const context = useContext(ObjectMetadataContext);
  if (!context) {
    throw new Error("useObjectMetadata debe usarse dentro de ObjectMetadataProvider");
  }
  return context;
}
