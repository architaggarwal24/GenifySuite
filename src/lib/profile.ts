const FIRST_NAMES = [
  "Olivia", "Liam", "Emma", "Noah", "Ava", "Oliver", "Sophia", "Elijah", "Isabella", "Mateo",
  "Mia", "Lucas", "Amelia", "Ethan", "Harper", "James", "Evelyn", "Benjamin", "Luna", "Henry",
  "Priya", "Arjun", "Wei", "Fatima", "Kenji", "Ingrid", "Diego", "Nia", "Sana", "Callum",
];

const LAST_NAMES = [
  "Bennett", "Okafor", "Nakamura", "Rossi", "Kowalski", "Garcia", "Novak", "Larsen", "Haddad",
  "Fischer", "Petrov", "Sato", "Mensah", "Dubois", "Alvarez", "Lindgren", "Yilmaz", "Singh",
  "Andersen", "Moreau", "Costa", "Wren", "Holt", "Abara", "Voss", "Marsh",
];

const STREET_NAMES = [
  "Maple", "Cedar", "Birch", "Harbor", "Willow", "Foundry", "Orchard", "Station", "Meridian",
  "Alder", "Bramble", "Quarry", "Linden", "Beacon", "Mill",
];

const STREET_TYPES = ["St", "Ave", "Rd", "Ln", "Way", "Dr", "Blvd", "Ct"];

const CITIES = [
  { city: "Austin", region: "TX", country: "United States" },
  { city: "Toronto", region: "ON", country: "Canada" },
  { city: "Manchester", region: "England", country: "United Kingdom" },
  { city: "Lyon", region: "Auvergne-Rhône-Alpes", country: "France" },
  { city: "Osaka", region: "Osaka", country: "Japan" },
  { city: "Pune", region: "Maharashtra", country: "India" },
  { city: "Wellington", region: "Wellington", country: "New Zealand" },
  { city: "Cape Town", region: "Western Cape", country: "South Africa" },
  { city: "Gothenburg", region: "Västra Götaland", country: "Sweden" },
  { city: "Curitiba", region: "Paraná", country: "Brazil" },
];

// RFC 2606 reserves these, so a seeded test account can never email a real person. (The previous list
// used real, registrable domains - a signup flow sending welcome emails to seeded users would have
// delivered them to strangers.)
const EMAIL_DOMAINS = ["example.com", "example.org", "example.net"];

const JOB_TITLES = [
  "Product Designer", "Backend Engineer", "QA Analyst", "Data Scientist", "Support Specialist",
  "Marketing Coordinator", "DevOps Engineer", "Technical Writer", "Sales Associate", "Office Manager",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * A US-format number in the 555-0100..0199 block that telecom authorities reserve for fiction, so
 * SMS/verification flows in seeded data can never reach a real phone. The area code is plausible
 * (first digit 2-9) and avoids the special N11 service codes (211, 311, ..., 911).
 */
function fictionalPhone(): string {
  let areaCode: string;
  do {
    areaCode = `${2 + Math.floor(Math.random() * 8)}${digits(2)}`;
  } while (areaCode.slice(1) === "11");
  return `+1-${areaCode}-555-01${digits(2)}`;
}

function digits(n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) out += Math.floor(Math.random() * 10);
  return out;
}

export interface FakeProfile {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  username: string;
  phone: string;
  jobTitle: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  birthDate: string;
}

export function generateFakeProfile(): FakeProfile {
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const location = pick(CITIES);
  const domain = pick(EMAIL_DOMAINS);
  const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 90 + 10)}`;

  const year = 1955 + Math.floor(Math.random() * 50);
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");

  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    email: `${username}@${domain}`,
    username,
    phone: fictionalPhone(),
    jobTitle: pick(JOB_TITLES),
    street: `${100 + Math.floor(Math.random() * 8899)} ${pick(STREET_NAMES)} ${pick(STREET_TYPES)}`,
    city: location.city,
    region: location.region,
    postalCode: digits(5),
    country: location.country,
    birthDate: `${year}-${month}-${day}`,
  };
}
