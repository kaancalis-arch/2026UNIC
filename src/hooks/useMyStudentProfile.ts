import { useEffect, useState } from 'react';
import type { Student } from '../types';
import { studentService } from '../services/studentService';

export function useMyStudentProfile(userId: string) {
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');
    void studentService.getMine(userId)
      .then(profile => {
        if (!cancelled) setStudent(profile);
      })
      .catch(loadError => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Profil yüklenemedi.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  return { student, isLoading, error };
}
