import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getObjects } from "../services/customService";

const ObjectMetadataContext = createContext(null);

export function ObjectMetadataProvider({ children }) {
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshObjects = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getObjects();
      setObjects(data || []);
      return data || [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshObjects();
  }, [refreshObjects]);

  const objectMap = useMemo(() => {
    return new Map(objects.map((item) => [item.apiName, item]));
  }, [objects]);

  const value = useMemo(() => ({
    objects,
    loading,
    refreshObjects,
    getObjectByApiNameFromCache: (apiName) => objectMap.get(apiName) || null,
  }), [objects, loading, refreshObjects, objectMap]);

  return <ObjectMetadataContext.Provider value={value}>{children}</ObjectMetadataContext.Provider>;
}

export function useObjectMetadata() {
  const context = useContext(ObjectMetadataContext);
  if (!context) {
    throw new Error("useObjectMetadata debe usarse dentro de ObjectMetadataProvider");
  }
  return context;
}
