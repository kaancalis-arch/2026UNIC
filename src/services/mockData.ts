
import { Student, PipelineStage, SystemUser, UserRole, CountryData, UniversityData } from "../types";

export const MOCK_USERS: SystemUser[] = [
  {
    id: "admin-1",
    firstName: "System",
    lastName: "Admin",
    email: "admin@unic.com",
    role: UserRole.ADMIN,
    isActive: true,
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin"
  },
  {
    id: "consultant-1",
    firstName: "Jane",
    lastName: "Cooper",
    email: "jane@unic.com",
    role: UserRole.CONSULTANT,
    isActive: true,
    parentId: "admin-1",
    phone: "+1 555 0123",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jane"
  },
  {
    id: "rep-1",
    firstName: "Robert",
    lastName: "Fox",
    email: "robert@agency.com",
    role: UserRole.REPRESENTATIVE,
    isActive: true,
    parentId: "consultant-1",
    phone: "+1 555 0199",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Robert"
  },
  {
    id: "student-user-1",
    firstName: "Alex",
    lastName: "Mercer",
    email: "alex.m@example.com",
    role: UserRole.STUDENT,
    isActive: true,
    avatarUrl: "https://picsum.photos/200/200?random=1"
  }
];

export const MOCK_STUDENTS: Student[] = [
  {
    id: "uuid-1",
    firstName: "Alex",
    lastName: "Mercer",
    email: "alex.m@example.com",
    phone: "+1 555 0101",
    pipelineStage: PipelineStage.ANALYSE,
    gpa: 3.8,
    targetDegree: "Master",
    targetCountries: ["Germany", "Netherlands"],
    budget: 15000,
    englishLevel: "C1",
    interests: ["AI", "Robotics", "Sustainable Energy"],
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
    targetDegree: "Bachelor",
    targetCountries: ["USA", "Canada"],
    budget: 35000,
    englishLevel: "B2",
    interests: ["Business", "Marketing", "Fashion"],
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
    pipelineStage: PipelineStage.OFFER,
    gpa: 3.5,
    targetDegree: "Master",
    targetCountries: ["UK"],
    budget: 20000,
    englishLevel: "B2",
    interests: ["Public Health", "Nursing"],
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
        country: 'Germany',
        city: 'Munich',
        websiteUrl: 'https://www.tum.de/en/',
        departmentsUrl: 'https://www.tum.de/en/studies/degree-programs',
        tuitionRange: '0 - 1.000€ (State)'
    },
    {
        id: 'uni-2',
        name: 'University of Amsterdam',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/University_of_Amsterdam_logo.svg/200px-University_of_Amsterdam_logo.svg.png',
        country: 'Netherlands',
        city: 'Amsterdam',
        websiteUrl: 'https://www.uva.nl/en',
        departmentsUrl: 'https://www.uva.nl/en/education/bachelors/bachelors.html',
        tuitionRange: '10.000€ - 15.000€'
    }
];

export const MOCK_TUITION_RANGES = [
  "Bütçe Konusunda Kararsızım",
  "0 - 6.000 (Devlet Okulları)",
  "6.000 - 12.000",
  "12.000 - 18.000",
  "18.000 - 24.000",
  "24.000 ve üzeri"
];
