import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCases, createCase, deleteCase } from "@/lib/api";
import { Case } from "@/types";

/**
 * Hook for managing all forensic cases.
 * 
 * This abstracts the data fetching logic away from the UI, providing
 * consistent loading, error, and cached states across the application.
 */
export function useCases() {
  const queryClient = useQueryClient();

  // 1. Fetching all cases
  const { data: cases = [], isLoading, error } = useQuery<Case[]>({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  // 2. Creating a new case (with automatic cache invalidation)
  const createMutation = useMutation({
    mutationFn: (newCase: Partial<Case>) => createCase(newCase),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });

  // 3. Deleting a case
  const deleteMutation = useMutation({
    mutationFn: (caseId: string) => deleteCase(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });

  return {
    cases,
    isLoading,
    error,
    createCase: createMutation.mutate,
    isCreating: createMutation.isPending,
    deleteCase: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
