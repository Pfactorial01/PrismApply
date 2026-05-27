const MAX_PART_LEN = 40;

export function sanitizeFilenamePart(s: string): string {
  return s
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, MAX_PART_LEN)
    .replace(/^_|_$/g, "");
}

export function buildResumeFilename(input: {
  fullName: string;
  company: string;
  roleTitle: string;
}): string {
  const name = sanitizeFilenamePart(input.fullName) || "Applicant";
  const company = sanitizeFilenamePart(input.company) || "Company";
  const role = sanitizeFilenamePart(input.roleTitle) || "Role";
  return `${name}_${company}_${role}_Resume.pdf`;
}
