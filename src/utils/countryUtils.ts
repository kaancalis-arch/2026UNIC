export const getFlagEmoji = (countryName: string): string => {
  const flags: Record<string, string> = {
    // Turkish names
    "Amerika Birleşik Devletleri": "🇺🇸",
    "Birleşik Krallık": "🇬🇧",
    "Kanada": "🇨🇦",
    "Almanya": "🇩🇪",
    "Hollanda": "🇳🇱",
    "İtalya": "🇮🇹",
    "Fransa": "🇫🇷",
    "Avustralya": "🇦🇺",
    "İrlanda": "🇮🇪",
    "Polonya": "🇵🇱",
    "Macaristan": "🇭🇺",
    "İngiltere": "🇬🇧",
    "Amerika": "🇺🇸",
    
    // English names
    "USA": "🇺🇸",
    "UK": "🇬🇧",
    "Canada": "🇨🇦",
    "Germany": "🇩🇪",
    "Netherlands": "🇳🇱",
    "Italy": "🇮🇹",
    "France": "🇫🇷",
    "Australia": "🇦🇺",
    "Ireland": "🇮🇪",
    "Poland": "🇵🇱",
    "Hungary": "🇭🇺"
  };
  
  // Clean string and try to find flag
  const cleaned = countryName.trim();
  return flags[cleaned] || "🏳️";
};
export const getCountryCode = (countryName: string): string => {
  const codes: Record<string, string> = {
    // Turkish names
    "Amerika Birleşik Devletleri": "us",
    "Birleşik Krallık": "gb",
    "Kanada": "ca",
    "Almanya": "de",
    "Hollanda": "nl",
    "İtalya": "it",
    "Fransa": "fr",
    "Avustralya": "au",
    "İrlanda": "ie",
    "Polonya": "pl",
    "Macaristan": "hu",
    "İngiltere": "gb",
    "Amerika": "us",
    
    // English names
    "USA": "us",
    "UK": "gb",
    "Canada": "ca",
    "Germany": "de",
    "Netherlands": "nl",
    "Italy": "it",
    "France": "fr",
    "Australia": "au",
    "Ireland": "ie",
    "Poland": "pl",
    "Hungary": "hu"
  };
  
  return codes[countryName.trim()] || "";
};
