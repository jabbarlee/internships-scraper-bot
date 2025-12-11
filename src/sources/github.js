import axios from "axios";

const GITHUB_RAW_URL =
  "https://raw.githubusercontent.com/vanshb03/Summer2026-Internships/dev/README.md";

// Locations to filter by
const ALLOWED_LOCATIONS = [
  "New York",
  "San Francisco",
  "Boston",
  "Houston",
  "Remote",
];

// Role keywords to filter by
const ROLE_KEYWORDS = ["Software", "Engineer"];

/**
 * Fetches and parses internship listings from the GitHub README
 * @returns {Promise<Array<{company: string, role: string, location: string, link: string, source: string}>>}
 */
async function scrapeGitHubInternships() {
  try {
    // Fetch the raw Markdown content
    const response = await axios.get(GITHUB_RAW_URL);
    const markdown = response.data;

    // Parse the Markdown table
    const internships = parseMarkdownTable(markdown);

    // Filter internships based on role and location criteria
    const filteredInternships = filterInternships(internships);

    return filteredInternships;
  } catch (error) {
    console.error("Error fetching GitHub internships:", error.message);
    throw error;
  }
}

/**
 * Parses the Markdown table from the README content
 * @param {string} markdown - Raw markdown content
 * @returns {Array<{company: string, role: string, location: string, link: string, datePosted: string}>}
 */
function parseMarkdownTable(markdown) {
  const internships = [];

  // Split by lines
  const lines = markdown.split("\n");

  let lastCompany = ""; // Track last company for rows that use ↳ symbol
  let inTable = false;

  for (const line of lines) {
    // Detect table header row
    if (line.includes("| Company") && line.includes("| Role")) {
      inTable = true;
      continue;
    }

    // Skip separator row (| --- | --- | ... |)
    if (line.match(/^\|\s*[-:]+\s*\|/)) {
      continue;
    }

    // Stop parsing when we hit contributor section or end of table
    if (inTable && !line.startsWith("|")) {
      break;
    }

    // Skip if not in table yet or empty lines
    if (!inTable || !line.startsWith("|")) {
      continue;
    }

    // Parse markdown table row: | Company | Role | Location | Application/Link | Date Posted |
    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);

    // We expect 5 cells: Company, Role, Location, Application/Link, Date Posted
    if (cells.length < 4) continue;

    const [
      companyCell,
      roleCell,
      locationCell,
      applicationCell,
      datePostedCell,
    ] = cells;

    // Parse company name
    let company = extractCompanyName(companyCell);

    // Handle continuation rows (↳ symbol means same company as previous)
    if (company === "↳" || company === "") {
      company = lastCompany;
    } else {
      lastCompany = company;
    }

    // Parse role (remove emoji flags like 🛂, 🇺🇸)
    const role = cleanText(roleCell);

    // Parse location (handle multiple locations and <details> tags)
    const location = extractLocation(locationCell);

    // Parse application link
    const link = extractApplicationLink(applicationCell);

    // Parse date posted
    const datePosted = datePostedCell ? cleanText(datePostedCell) : "";

    // Skip if essential fields are missing or application is closed (🔒)
    if (
      !company ||
      !role ||
      !link ||
      link === "🔒" ||
      applicationCell.includes("🔒")
    )
      continue;

    internships.push({
      company,
      role,
      location,
      link,
      datePosted,
      source: "GitHub",
    });
  }

  return internships;
}

/**
 * Extracts company name from cell content
 * @param {string} cellContent - Content of company cell
 * @returns {string}
 */
function extractCompanyName(cellContent) {
  // Check for ↳ symbol (continuation of previous company)
  if (cellContent.trim() === "↳") {
    return "↳";
  }

  // Extract text from anchor tag if present
  const linkMatch = cellContent.match(/<a[^>]*>([^<]+)<\/a>/i);
  if (linkMatch) {
    return cleanText(linkMatch[1]);
  }

  // Extract from markdown link [text](url)
  const mdLinkMatch = cellContent.match(/\[([^\]]+)\]\([^)]+\)/);
  if (mdLinkMatch) {
    return cleanText(mdLinkMatch[1]);
  }

  return cleanText(cellContent);
}

/**
 * Extracts location from cell content, handling multiple formats
 * @param {string} cellContent - Content of location cell
 * @returns {string}
 */
function extractLocation(cellContent) {
  // Handle <details> tag for multiple locations
  const detailsMatch = cellContent.match(
    /<details>[\s\S]*?<summary>[\s\S]*?\*\*(\d+\s+locations)\*\*[\s\S]*?<\/summary>([\s\S]*?)<\/details>/i
  );
  if (detailsMatch) {
    const locationList = detailsMatch[2];
    // Extract individual locations, they're separated by </br>
    const locations = locationList
      .split(/<\/br>|<br\s*\/?>|\n/i)
      .map((loc) => cleanText(loc))
      .filter((loc) => loc.length > 0);
    return locations.join(", ");
  }

  // Handle locations separated by </br>
  const locations = cellContent
    .split(/<\/br>|<br\s*\/?>|\n/i)
    .map((loc) => cleanText(loc))
    .filter((loc) => loc.length > 0);

  return locations.join(", ");
}

/**
 * Extracts the application link from cell content
 * @param {string} cellContent - Content of application cell
 * @returns {string}
 */
function extractApplicationLink(cellContent) {
  // Check if application is closed
  if (cellContent.includes("🔒")) {
    return "🔒";
  }

  // Look for href in HTML anchor tags
  const hrefMatch = cellContent.match(/<a\s+href="([^"]+)"/i);
  if (hrefMatch) {
    // Clean up tracking parameters
    return hrefMatch[1].split("?utm_source")[0];
  }

  // Look for markdown links [text](url)
  const mdLinkMatch = cellContent.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (mdLinkMatch) {
    return mdLinkMatch[2].split("?utm_source")[0];
  }

  return "";
}

/**
 * Removes HTML tags and cleans whitespace from text
 * @param {string} text - Text to clean
 * @returns {string}
 */
function cleanText(text) {
  return text
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Convert markdown links to text
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold markdown
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&apos;/g, "'")
    .replace(/🛂|🇺🇸/g, "") // Remove emoji flags
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Filters internships based on role and location criteria
 * @param {Array} internships - Array of internship objects
 * @returns {Array}
 */
function filterInternships(internships) {
  return internships.filter((internship) => {
    // Check if role contains "Software" or "Engineer" (case-insensitive)
    const roleMatches = ROLE_KEYWORDS.some((keyword) =>
      internship.role.toLowerCase().includes(keyword.toLowerCase())
    );

    // Check if location contains any of the allowed locations (case-insensitive)
    const locationMatches = ALLOWED_LOCATIONS.some((location) =>
      internship.location.toLowerCase().includes(location.toLowerCase())
    );

    return roleMatches && locationMatches;
  });
}

// Main execution - run when script is called directly
async function main() {
  console.log("🔍 Fetching internships from GitHub...\n");

  try {
    const internships = await scrapeGitHubInternships();

    console.log(`✅ Found ${internships.length} matching internships:\n`);

    internships.forEach((internship, index) => {
      console.log(`${index + 1}. ${internship.company}`);
      console.log(`   Role: ${internship.role}`);
      console.log(`   Location: ${internship.location}`);
      console.log(`   Date Posted: ${internship.datePosted}`);
      console.log(`   Link: ${internship.link}`);
      console.log("");
    });

    return internships;
  } catch (error) {
    console.error("❌ Failed to scrape internships:", error.message);
    process.exit(1);
  }
}

// Run main function
main();

// Export for use as module
export { scrapeGitHubInternships, parseMarkdownTable, filterInternships };
