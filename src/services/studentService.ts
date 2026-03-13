
import { supabase } from './supabaseClient';
import { Student, PipelineStage } from '../types';
import { MOCK_STUDENTS } from './mockData';

// Helpers to map snake_case DB columns to camelCase TS props
function mapDbToStudent(row: any): Student {
    return {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        dob: row.dob,
        pipelineStage: row.pipeline_stage as PipelineStage,
        gpa: row.gpa,
        targetDegree: row.target_degree,
        targetCountries: row.target_countries || [],
        budget: row.budget || 0,
        englishLevel: row.english_level,
        interests: row.interests || [],
        avatarUrl: row.avatar_url,
        schoolName: row.school_name,
        currentGrade: row.current_grade,
        educationStatus: row.education_status,
        
        // Map individual DB columns to the parentInfo object
        parentInfo: {
            fullName: row.parent_name || '',
            relationship: row.relationship || '',
            phone: row.parent_phone || '',
            email: row.parent_email || ''
        },

        hasForeignCitizenship: row.has_foreign_citizenship,
        foreignCitizenshipNote: row.foreign_citizenship_note,
        hasGreenPassport: row.has_green_passport,
        analysis: row.analysis,
        counselorNotes: row.counselor_notes,
        counselorId: row.counselor_id,
        representativeId: row.representative_id
    };
}

function mapStudentToDb(student: Partial<Student>): any {
    const dbObj: any = {
        first_name: student.firstName,
        last_name: student.lastName,
        email: student.email,
        phone: student.phone,
        dob: student.dob,
        pipeline_stage: student.pipelineStage,
        gpa: student.gpa,
        target_degree: student.targetDegree,
        target_countries: student.targetCountries,
        budget: student.budget,
        english_level: student.englishLevel,
        interests: student.interests,
        avatar_url: student.avatarUrl,
        school_name: student.schoolName,
        current_grade: student.currentGrade,
        education_status: student.educationStatus,
        
        // Map parentInfo object properties to individual DB columns
        parent_name: student.parentInfo?.fullName,
        relationship: student.parentInfo?.relationship,
        parent_phone: student.parentInfo?.phone,
        parent_email: student.parentInfo?.email,

        has_foreign_citizenship: student.hasForeignCitizenship,
        foreign_citizenship_note: student.foreignCitizenshipNote,
        has_green_passport: student.hasGreenPassport,
        analysis: student.analysis,
        counselor_notes: student.counselorNotes,
        counselor_id: student.counselorId,
        representative_id: student.representativeId
    };

    // Remove undefined keys to avoid overwriting with nulls if using patch
    Object.keys(dbObj).forEach(key => dbObj[key] === undefined && delete dbObj[key]);
    return dbObj;
}

export const studentService = {
  async getAll(): Promise<Student[]> {
    if (!supabase) return MOCK_STUDENTS;

    try {
        const { data, error } = await supabase
        .from('student_profiles')
        .select('*')
        .order('created_at', { ascending: false });

        if (error) {
            console.warn('Supabase fetch failed (likely invalid key or table missing). Using mock data. Error:', error.message);
            // In a real scenario, you might want to show an error or empty list, 
            // but for resilience we fall back to mock data if the DB connection fails completely.
            return MOCK_STUDENTS;
        }

        if (!data) return MOCK_STUDENTS;

        return data.map(mapDbToStudent);
    } catch (err) {
        console.warn('Unexpected error in studentService.getAll. Using mock data.', err);
        return MOCK_STUDENTS;
    }
  },

  async create(student: Partial<Student>): Promise<Student> {
    if (!supabase) {
        return { ...student, id: `local-${Date.now()}` } as Student;
    }

    const dbStudent = mapStudentToDb(student);

    try {
        const { data, error } = await supabase
        .from('student_profiles')
        .insert([dbStudent])
        .select()
        .single();

        if (error) {
            // Throw a readable error so the UI can display it
            throw new Error(error.message || "Database insert failed");
        }
        if (!data) throw new Error("No data returned from insert");
        
        return mapDbToStudent(data);
    } catch (err: any) {
        console.error('Error in studentService.create:', err);
        throw err; // Re-throw to be caught by the UI
    }
  },

  async update(id: string, updates: Partial<Student>): Promise<void> {
      if (!supabase) return;
      
      const dbUpdates = mapStudentToDb(updates);

      try {
        const { error } = await supabase
            .from('student_profiles')
            .update(dbUpdates)
            .eq('id', id);
            
        if (error) {
            console.error('Supabase update failed:', error.message);
            throw new Error(error.message);
        }
      } catch (err: any) {
        console.error('Unexpected error updating student:', err);
        throw err;
      }
  },

  async delete(id: string): Promise<void> {
      if (!supabase) return;
      try {
        const { error } = await supabase.from('student_profiles').delete().eq('id', id);
        if (error) {
            console.error('Supabase delete failed:', error.message);
            throw new Error(error.message);
        }
      } catch (err: any) {
        console.error('Unexpected error deleting student:', err);
        throw err;
      }
  }
};
