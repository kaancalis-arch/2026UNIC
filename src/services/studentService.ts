
import { supabase } from './supabaseClient';
import { Student, PipelineStage, UserRole } from '../types';

// Helpers to map snake_case DB columns to camelCase TS props
function mapDbToStudent(row: any): Student {
    return {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        dob: row.dob,
        reminderDate: row.reminder_date,
        pipelineStage: row.pipeline_stage as PipelineStage,
        gpa: row.gpa,
        targetDegree: row.target_degree,
        targetCountries: row.target_countries || [],
        budget: row.budget || 0,
        englishLevel: row.english_level,
        interests: row.interests || [],
        targetPrograms: row.target_programs || [],
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
        parent2Info: {
            fullName: row.parent2_name || '',
            relationship: row.parent2_relationship || '',
            phone: row.parent2_phone || '',
            email: row.parent2_email || ''
        },

        hasForeignCitizenship: row.has_foreign_citizenship,
        foreignCitizenshipNote: row.foreign_citizenship_note,
        hasGreenPassport: row.has_green_passport,
        analysis: row.analysis,
        documents: row.analysis?.documents || [],
        counselorNotes: row.counselor_notes,
        branchId: row.branch_id,
        // counselor_id is retained in the database to avoid a risky column rename.
        assignedUserId: row.counselor_id,
        analyseStatus: row.analyse_status,
        applications: row.applications || [],
        visaStatus: row.visa_status,
        visaApplicationDate: row.visa_application_date,
        visaType: row.visa_type,
        visaCountry: row.visa_country,
        visaReports: row.visa_reports || []
    };
}

type StudentDateField = 'dob' | 'reminderDate' | 'visaApplicationDate';

const STUDENT_DATE_FIELD_LABELS: Record<StudentDateField, string> = {
    dob: 'Doğum tarihi',
    reminderDate: 'Hatırlatma tarihi',
    visaApplicationDate: 'Vize başvuru tarihi'
};

function mapOptionalStudentDate(student: Partial<Student>, key: StudentDateField): string | null | undefined {
    if (!Object.prototype.hasOwnProperty.call(student, key)) return undefined;

    const value = student[key];
    if (value === '' || value === null || value === undefined) return null;

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) {
        const [, year, month, day] = match;
        const date = new Date(`${value}T00:00:00Z`);
        if (
            !Number.isNaN(date.getTime())
            && Number(year) > 0
            && date.getUTCFullYear() === Number(year)
            && date.getUTCMonth() + 1 === Number(month)
            && date.getUTCDate() === Number(day)
        ) {
            return value;
        }
    }

    throw new Error(`${STUDENT_DATE_FIELD_LABELS[key]} YYYY-MM-DD biçiminde geçerli bir tarih olmalıdır.`);
}

function mapStudentToDb(student: Partial<Student>): any {
    const dbObj: any = {
        first_name: student.firstName,
        last_name: student.lastName,
        email: student.email,
        phone: student.phone,
        dob: mapOptionalStudentDate(student, 'dob'),
        reminder_date: mapOptionalStudentDate(student, 'reminderDate'),
        pipeline_stage: student.pipelineStage,
        gpa: student.gpa,
        target_degree: student.targetDegree,
        target_countries: student.targetCountries,
        budget: student.budget,
        english_level: student.englishLevel,
        interests: student.interests,
        target_programs: student.targetPrograms,
        avatar_url: student.avatarUrl,
        school_name: student.schoolName,
        current_grade: student.currentGrade,
        education_status: student.educationStatus,

        // Map parentInfo object properties to individual DB columns
        parent_name: student.parentInfo?.fullName,
        relationship: student.parentInfo?.relationship,
        parent_phone: student.parentInfo?.phone,
        parent_email: student.parentInfo?.email,

        parent2_name: student.parent2Info?.fullName,
        parent2_relationship: student.parent2Info?.relationship,
        parent2_phone: student.parent2Info?.phone,
        parent2_email: student.parent2Info?.email,

        has_foreign_citizenship: student.hasForeignCitizenship,
        foreign_citizenship_note: student.foreignCitizenshipNote,
        has_green_passport: student.hasGreenPassport,
        analysis: student.analysis || student.documents !== undefined
            ? {
                ...(student.analysis || {}),
                ...(student.documents !== undefined ? {
                    documents: student.documents.map(document => {
                        if (!document.storagePath) return document;
                        const { url: _signedUrl, ...storedDocument } = document;
                        return storedDocument;
                    })
                } : {})
            }
            : undefined,
        counselor_notes: student.counselorNotes,
        branch_id: student.branchId === '' ? null : student.branchId,
        counselor_id: student.assignedUserId === '' ? null : student.assignedUserId,
        analyse_status: student.analyseStatus,
        applications: student.applications,
        visa_status: student.visaStatus,
        visa_application_date: mapOptionalStudentDate(student, 'visaApplicationDate'),
        visa_type: student.visaType,
        visa_country: student.visaCountry,
        visa_reports: student.visaReports
    };

    // Remove undefined keys to avoid overwriting with nulls if using patch
    Object.keys(dbObj).forEach(key => dbObj[key] === undefined && delete dbObj[key]);
    return dbObj;
}

const ASSIGNABLE_ROLES = new Set<UserRole>([
    UserRole.CONSULTANT,
    UserRole.REPRESENTATIVE,
    UserRole.STUDENT_REPRESENTATIVE
]);

async function validateAssignment(student: Partial<Student>): Promise<void> {
    if (!student.assignedUserId) return;
    if (!student.branchId) {
        throw new Error('Sorumlu kullanıcı atamak için öğrencinin şubesi belirtilmelidir.');
    }
    if (!supabase) throw new Error('Supabase yapılandırması bulunamadı.');

    const { data: assignedUser, error } = await supabase
        .from('system_users')
        .select('id, role, status, branch_id')
        .eq('id', student.assignedUserId)
        .maybeSingle();

    if (error) throw new Error(error.message || 'Sorumlu kullanıcı doğrulanamadı.');
    if (!assignedUser) throw new Error('Seçilen sorumlu kullanıcı bulunamadı.');
    if (!ASSIGNABLE_ROLES.has(assignedUser.role as UserRole)) {
        throw new Error('Öğrenci yalnızca Danışman, Temsilci veya Öğrenci Temsilcisine atanabilir.');
    }
    if (assignedUser.status !== 'active') {
        throw new Error('Öğrenci yalnızca aktif bir kullanıcıya atanabilir.');
    }
    if (assignedUser.branch_id !== student.branchId) {
        throw new Error('Öğrenci ile sorumlu kullanıcı aynı şubede olmalıdır.');
    }
}

export const studentService = {
    async getAll(): Promise<Student[]> {
        if (!supabase) throw new Error('Supabase yapılandırması bulunamadı.');

        const { data, error } = await supabase
            .from('student_profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Öğrenci sorgusu başarısız:', error);
            throw new Error('Öğrenciler yüklenemedi. Lütfen tekrar deneyin.');
        }
        if (!data) throw new Error('Öğrenci verisi alınamadı. Lütfen tekrar deneyin.');

        return data.map(mapDbToStudent);
    },

    async findDuplicateContact(email?: string, phone?: string, excludeId?: string): Promise<Student | null> {
        if (!supabase) throw new Error('Supabase yapılandırması bulunamadı.');

        const normalizedEmail = email?.trim().toLowerCase();
        const normalizedPhone = phone?.trim();

        try {
            if (normalizedEmail) {
                let emailQuery = supabase
                    .from('student_profiles')
                    .select('*')
                    .ilike('email', normalizedEmail)
                    .limit(1);

                if (excludeId) {
                    emailQuery = emailQuery.neq('id', excludeId);
                }

                const { data: emailData, error: emailError } = await emailQuery;

                if (emailError) {
                    throw new Error(emailError.message || 'E-posta kontrolü başarısız oldu');
                }

                if (emailData && emailData.length > 0) {
                    return mapDbToStudent(emailData[0]);
                }
            }

            if (normalizedPhone) {
                let phoneQuery = supabase
                    .from('student_profiles')
                    .select('*')
                    .eq('phone', normalizedPhone)
                    .limit(1);

                if (excludeId) {
                    phoneQuery = phoneQuery.neq('id', excludeId);
                }

                const { data: phoneData, error: phoneError } = await phoneQuery;

                if (phoneError) {
                    throw new Error(phoneError.message || 'Telefon kontrolü başarısız oldu');
                }

                if (phoneData && phoneData.length > 0) {
                    return mapDbToStudent(phoneData[0]);
                }
            }

            return null;
        } catch (err: any) {
            console.error('Error in studentService.findDuplicateContact:', err);
            throw err;
        }
    },

    async create(student: Partial<Student>): Promise<Student> {
        if (!student.targetPrograms || student.targetPrograms.length === 0) {
            throw new Error('En az bir program seçilmelidir.');
        }

        if (student.branchId || student.assignedUserId) {
            throw new Error('Öğrenciyi önce atanmamış oluşturun; şube ve sorumlu için Öğrenci Atamaları sayfasını kullanın.');
        }

        await validateAssignment(student);

        if (!supabase) throw new Error('Supabase yapılandırması bulunamadı.');

        const dbStudent = mapStudentToDb(student);
        delete dbStudent.branch_id;
        delete dbStudent.counselor_id;

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
        if (!supabase) throw new Error('Supabase yapılandırması bulunamadı.');

        const updatesAssignment = updates.assignedUserId !== undefined || updates.branchId !== undefined;
        if (updatesAssignment) {
            const { data: currentStudent, error } = await supabase
                .from('student_profiles')
                .select('branch_id, counselor_id')
                .eq('id', id)
                .single();

            if (error) throw new Error(error.message || 'Öğrenci atama bilgisi okunamadı.');
            const requestedBranchId = updates.branchId === undefined
                ? currentStudent.branch_id
                : updates.branchId || null;
            const requestedAssignedUserId = updates.assignedUserId === undefined
                ? currentStudent.counselor_id
                : updates.assignedUserId || null;
            if (requestedBranchId !== currentStudent.branch_id || requestedAssignedUserId !== currentStudent.counselor_id) {
                throw new Error('Şube ve sorumlu değişikliklerini Öğrenci Atamaları sayfasından yapın.');
            }
        }

        const dbUpdates = mapStudentToDb(updates);
        delete dbUpdates.branch_id;
        delete dbUpdates.counselor_id;

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
        if (!supabase) throw new Error('Supabase yapılandırması bulunamadı.');
        try {
            const { data, error } = await supabase.from('student_profiles').delete().eq('id', id).select();

            if (error) {
                console.error('Supabase delete failed:', error.message);
                throw new Error(error.message);
            }

            // Supabase RLS (Row Level Security) kurallarında DELETE izni (Policy) yoksa, hata (error) döndürmek 
            // yerine 0 satır silip boş bir array döndürür. Bu durumu yakalayalım:
            if (!data || data.length === 0) {
                throw new Error("VERİTABANI YETKİ HATASI: Kayıt silinemedi. Lütfen Supabase'de 'student_profiles' tablosu için DELETE RLS Policy (Silme izni) eklediğinizden emin olun.");
            }
        } catch (err: any) {
            console.error('Unexpected error deleting student:', err);
            throw err;
        }
    }
};
