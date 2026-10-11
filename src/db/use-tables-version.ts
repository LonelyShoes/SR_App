import { useEffect, useState } from 'react';
import { addDatabaseChangeListener } from 'expo-sqlite';

/**
 * Counter that bumps whenever any of the given tables changes.
 * Pass it in `useLiveQuery` deps for joined queries: drizzle's useLiveQuery
 * only listens to the query's main (FROM) table.
 */
export const useTablesVersion = (tableNames: string[]) => {
  const [version, setVersion] = useState(0);
  const key = tableNames.join(',');

  useEffect(() => {
    const watched = new Set(key.split(','));
    const subscription = addDatabaseChangeListener(({ tableName }) => {
      if (watched.has(tableName)) setVersion((v) => v + 1);
    });
    return () => subscription.remove();
  }, [key]);

  return version;
};
