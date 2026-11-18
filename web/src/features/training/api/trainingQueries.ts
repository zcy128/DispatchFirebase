import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TrainingService } from '../../../services/trainingService';
import { TrainingCourse, TrainingType } from '../../../types/training';

export interface TrainingCatalogData {
  courses: TrainingCourse[];
  trainingTypes: TrainingType[];
}

/**
 * Query key factory for training courses and catalog types.
 */
export const trainingKeys = {
  all: ['training'] as const,
  catalog: () => [...trainingKeys.all, 'catalog'] as const,
};

/**
 * Queries training courses and types with TanStack Query and mirrors
 * real-time Firestore course updates into the shared cache.
 */
export function useTrainingDataQuery() {
  const queryClient = useQueryClient();
  const queryKey = trainingKeys.catalog();

  const query = useQuery<TrainingCatalogData, Error>({
    queryKey,
    queryFn: async () => {
      const [coursesData, typesData] = await Promise.all([
        TrainingService.listCourses(),
        TrainingService.listTrainingTypes(),
      ]);
      return {
        courses: Array.isArray(coursesData) ? coursesData : [],
        trainingTypes: Array.isArray(typesData) ? typesData : [],
      };
    },
  });

  useEffect(() => {
    const unsubscribe = TrainingService.subscribeToTrainingCourses(
      (updatedCourses) => {
        queryClient.setQueryData<TrainingCatalogData>(trainingKeys.catalog(), (prev) => ({
          courses: Array.isArray(updatedCourses) ? updatedCourses : [],
          trainingTypes: prev?.trainingTypes ?? [],
        }));
      },
      (err) => {
        console.error('Training courses subscription error:', err);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [queryClient]);

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query.refetch]);

  return {
    courses: query.data?.courses ?? [],
    trainingTypes: query.data?.trainingTypes ?? [],
    loading: query.isLoading,
    error: query.error ? 'Failed to load training courses. Please refresh.' : null,
    refresh,
  };
}
