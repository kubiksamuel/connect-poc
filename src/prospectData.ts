export const prospectData = {
  firstName: "John",
  lastName: "Doe",
  company: "Apple",
  role: "CTO",
  industry: "Technology",
  communicationFrequency: "occasionally",
  category: "Entrepreneur",
  country: "United States",
};

// Helper function to format prospect data in natural language for better AI understanding
export function getProspectContext(data = prospectData): string {
  const {
    firstName,
    lastName,
    company,
    role,
    industry,
    communicationFrequency,
    category,
    country,
  } = data;

  return `You are reaching out to ${firstName} ${lastName}, who is the ${role} at ${company} (a ${industry} company). ${firstName} is an ${category} based in ${country} who communicates with salesmen ${communicationFrequency}. When crafting messages, consider their seniority level (${role}) and communication style.`;
}

export const MAX_FOLLOW_UP_ATTEMPTS = 1;
