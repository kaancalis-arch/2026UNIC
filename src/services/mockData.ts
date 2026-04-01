
import { Student, PipelineStage, SystemUser, UserRole, CountryData, UniversityData, MainDegreeData, InterestedProgramData, Branch } from "../types";


export const MOCK_BRANCHES: Branch[] = [
  {
    id: "branch-1",
    name: "İstanbul Şubesi",
    country: "Türkiye",
    city: "İstanbul",
    address: "Kadıköy, İstanbul",
    phone: "+90 216 123 4567",
    email: "istanbul@unic.com",
    status: "active",
    manager_id: "branch-manager-1",
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z"
  },
  {
    id: "branch-2",
    name: "Ankara Şubesi",
    country: "Türkiye",
    city: "Ankara",
    address: "Çankaya, Ankara",
    phone: "+90 312 123 4567",
    email: "ankara@unic.com",
    status: "active",
    manager_id: "branch-manager-2",
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z"
  }
];

export const MOCK_USERS: SystemUser[] = [
  {
    id: "super-admin-1",
    full_name: "System Super Admin",
    email: "superadmin@unic.com",
    phone: "+90 216 123 4567",
    role: UserRole.SUPER_ADMIN,
    branch_id: "branch-1", // Super admin can access all, but assign to one
    status: "active",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=SuperAdmin",
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z"
  },
  {
    id: "admin-1",
    full_name: "System Admin",
    email: "admin@unic.com",
    phone: "+90 216 123 4568",
    role: UserRole.ADMIN,
    branch_id: "branch-1",
    parent_user_id: "super-admin-1",
    status: "active",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin",
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z"
  },
  {
    id: "branch-manager-1",
    full_name: "Ahmet Yılmaz",
    email: "ahmet@unic.com",
    phone: "+90 216 123 4569",
    role: UserRole.BRANCH_MANAGER,
    branch_id: "branch-1",
    parent_user_id: "admin-1",
    status: "active",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=BranchManager",
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z"
  },
  {
    id: "consultant-1",
    full_name: "Jane Cooper",
    email: "jane@unic.com",
    phone: "+90 216 123 4570",
    role: UserRole.CONSULTANT,
    branch_id: "branch-1",
    parent_user_id: "branch-manager-1",
    status: "active",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jane",
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z"
  },
  {
    id: "rep-1",
    full_name: "Robert Fox",
    email: "robert@agency.com",
    phone: "+90 216 123 4571",
    role: UserRole.REPRESENTATIVE,
    branch_id: "branch-1",
    parent_user_id: "consultant-1",
    status: "active",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Robert",
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z"
  },
  {
    id: "student-rep-1",
    full_name: "Mehmet Kaya",
    email: "mehmet@unic.com",
    phone: "+90 216 123 4572",
    role: UserRole.STUDENT_REPRESENTATIVE,
    branch_id: "branch-1",
    parent_user_id: "rep-1",
    status: "active",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=StudentRep",
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z"
  },
  {
    id: "student-user-1",
    full_name: "Alex Mercer",
    email: "alex.m@example.com",
    phone: "+90 216 123 4573",
    role: UserRole.STUDENT,
    branch_id: "branch-1",
    parent_user_id: "student-rep-1",
    status: "active",
    avatarUrl: "https://picsum.photos/200/200?random=1",
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z"
  }
];

export const MOCK_STUDENTS: Student[] = [
  {
    id: "uuid-1",
    firstName: "Alex",
    lastName: "Mercer",
    email: "alex.m@example.com",
    phone: "+1 555 0101",
    parentInfo: { fullName: "Ahmet Çalış", relationship: "Baba", phone: "05321112233", email: "ahmet@example.com" },
    parent2Info: { fullName: "Ayşe Çalış", relationship: "Anne", phone: "05334445566", email: "ayse@example.com" },
    pipelineStage: PipelineStage.ANALYSE,
    gpa: 3.8,
    targetDegree: "Master",
    targetCountries: ["Germany", "Netherlands"],
    budget: 15000,
    englishLevel: "C1",
    interests: ["AI", "Robotics", "Sustainable Energy"],
    targetPrograms: ["Computer Science", "Artificial Intelligence"],
    avatarUrl: "https://picsum.photos/200/200?random=1",
    schoolName: "Tech University Berlin",
    currentGrade: "4. Sınıf",
    educationStatus: "University",
    counselorId: "consultant-1",
    documents: [
      { id: 'passport', type: 'Pasaport', uploadedAt: '2023-09-01', expiryDate: '2024-05-15' }, // Expiring soon
      { id: 'transcript', type: 'Transkript', uploadedAt: '2023-09-05' }
    ]
  },
  {
    id: "uuid-2",
    firstName: "Sarah",
    lastName: "Chen",
    email: "sarah.c@example.com",
    phone: "+86 139 0000",
    pipelineStage: PipelineStage.PROCESS,
    gpa: 3.2,
    targetDegree: "Undergraduate",
    targetCountries: ["USA", "Canada"],
    budget: 35000,
    englishLevel: "B2",
    interests: ["Business", "Marketing", "Fashion"],
    targetPrograms: ["Business Management"],
    avatarUrl: "https://picsum.photos/200/200?random=2",
    schoolName: "Shanghai Int. High School",
    currentGrade: "12. Sınıf",
    educationStatus: "High School",
    counselorId: "consultant-1",
    representativeId: "rep-1",
    documents: [
      { id: 'passport', type: 'Pasaport', uploadedAt: '2023-01-01', expiryDate: '2028-01-01' } // Valid
    ]
  },
  {
    id: "uuid-3",
    firstName: "Michael",
    lastName: "Ojo",
    email: "m.ojo@example.com",
    phone: "+234 800 000",
    pipelineStage: PipelineStage.ENROLLMENT,
    gpa: 3.5,
    targetDegree: "Master",
    targetCountries: ["UK"],
    budget: 20000,
    englishLevel: "B2",
    interests: ["Public Health", "Nursing"],
    targetPrograms: ["Nursing"],
    avatarUrl: "https://picsum.photos/200/200?random=3",
    schoolName: "Lagos State University",
    currentGrade: "Mezun",
    educationStatus: "Graduate",
    counselorId: "consultant-1"
  }
];

export const MOCK_COUNTRIES: CountryData[] = [
    {
        id: 'usa',
        name: 'United States',
        flag: '🇺🇸',
        capital: 'Washington, D.C.',
        currency: 'USD ($)',
        population: '331.9 Million',
        cities: ['New York', 'Los Angeles', 'Chicago', 'Boston', 'San Francisco'],
        imageUrl: 'https://images.unsplash.com/photo-1485738422979-f5c462d49f74?q=80&w=2000&auto=format&fit=crop',
        educationSystemDescription: 'The US higher education system is known for its flexibility. It typically includes Associate degrees (2 years), Bachelor\'s degrees (4 years), Master\'s degrees (1-2 years), and Doctoral degrees.',
        
        bachelorTypes: [
            {
                name: 'Community College (Associate Degree)',
                description: '2 yıllık eğitim. GPA 2.0+ ve TOEFL 60+ genelde yeterlidir. Daha ekonomik bir başlangıç sunar.'
            },
            {
                name: 'University (Bachelor\'s Degree)',
                description: '4 yıllık lisans eğitimi. Yüksek GPA, referans mektupları ve essay gerektirir. Erken başvurular Kasım ayında başlar.'
            }
        ],
        masterTypes: [
            {
                name: 'Professional Master (MBA etc.)',
                description: '1.5 - 2 yıl sürer. İş deneyimi ve yüksek GPA (3.0+) önemlidir.'
            }
        ],
        postGradWorkPermit: 'OPT (Optional Practical Training) ile 1 yıl, STEM bölümleri için +2 yıl (Toplam 3 yıl).',
        yksRequirement: 'YKS şartı aranmaz. Amerikan üniversiteleri kendi kabul kriterlerine göre öğrenci alır.',
        popularJobs: ['Computer Science', 'Business Administration', 'Engineering', 'Psychology']
    },
    {
        id: 'germany',
        name: 'Germany',
        flag: '🇩🇪',
        capital: 'Berlin',
        currency: 'EUR (€)',
        population: '83.2 Million',
        cities: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne'],
        imageUrl: 'https://images.unsplash.com/photo-1467269204594-9661b133dd2b?q=80&w=2000&auto=format&fit=crop',
        educationSystemDescription: 'German universities are mostly public and tuition-free. Distinguished between Universitäten (Research) and Fachhochschulen (Applied Sciences).',
        
        bachelorTypes: [
            {
                name: 'Universität (Devlet Üniversitesi)',
                description: '3 yıl sürer. Teorik ağırlıklıdır. Türkiye\'de 4 yıllık bir bölüm kazanmış olmak gerekir. C1 Almanca istenir.'
            },
            {
                name: 'Fachhochschule (Uygulamalı Bilimler)',
                description: '3.5 - 4 yıl sürer (Staj dahil). Pratik ağırlıklıdır. B2/C1 seviyesinde dil yeterliliği beklenir.'
            }
        ],
        masterTypes: [
            {
                name: 'Research Master',
                description: '2 yıl sürer. Akademik ve araştırma odaklıdır. İlgili alanda lisans diploması şarttır.'
            }
        ],
        postGradWorkPermit: 'Mezuniyet sonrası iş arama vizesi: 18 Ay.',
        yksRequirement: 'Türkiye\'de 4 yıllık bir lisans programına yerleşmiş olma şartı aranır (ÖSYM Sonuç Belgesi).',
        popularJobs: ['Engineering (Automotive, Mechanical)', 'Computer Science', 'Business', 'Medicine']
    }
];

export const MOCK_UNIVERSITIES: UniversityData[] = [
    {
        id: 'uni-1',
        name: 'Technical University of Munich',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Logo_Technical_University_of_Munich.svg/200px-Logo_Technical_University_of_Munich.svg.png',
        countries: ['Germany'],
        websiteUrl: 'https://www.tum.de/en/',
        departmentsUrl: 'https://www.tum.de/en/studies/degree-programs',
        tuitionRange: '0 - 1.000€ (State)'
    },
    {
        id: 'uni-2',
        name: 'University of Amsterdam',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/University_of_Amsterdam_logo.svg/200px-University_of_Amsterdam_logo.svg.png',
        countries: ['Netherlands'],
        websiteUrl: 'https://www.uva.nl/en',
        departmentsUrl: 'https://www.uva.nl/en/education/bachelors/bachelors.html',
        tuitionRange: '10.000€ - 15.000€'
    }
];

export const MOCK_MAIN_DEGREES: MainDegreeData[] = [
    {
        id: 'prog-1',
        name: 'Bilgisayar Mühendisliği',
        description: 'Yazılım, donanım ve bilgisayar sistemlerinin tasarımı, geliştirilmesi ve yönetimi üzerine odaklanan mühendislik dalıdır.',
        careerOpportunities: 'Yazılım Geliştirici, Sistem Analisti, Veri Bilimci, Siber Güvenlik Uzmanı.',
        aiImpact: 'Yapay zeka, bilgisayar mühendisliğinin temel bir parçası haline gelmiş olup, kodlama süreçlerini hızlandırmakta ve yeni çözüm yolları sunmaktadır.',
        topCompanies: 'Google, Microsoft, Apple, Amazon, Meta.',
        sectorStatusTR: 'Türkiye\'de teknokentler ve start-up ekosistemi sayesinde oldukça canlı bir sektördür.',
        imageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=2000&auto=format&fit=crop'
    }
];

export const MOCK_INTERESTED_PROGRAMS: InterestedProgramData[] = [
    { id: 'int-1', name: 'Computer Science', description: 'Software development and algorithms.' },
    { id: 'int-2', name: 'Law', description: 'Legal systems and justice.' },
    { id: 'int-3', name: 'Psychology', description: 'Human mind and behavior.' }
];

export const MOCK_TUITION_RANGES = [
  "Bütçe Konusunda Kararsızım",
  "5.000'e kadar",
  "10.000'e kadar",
  "15.000'e kadar",
  "20.000'e kadar",
  "20.000 üzeri uygundur"
];

