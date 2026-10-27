const prisma = require('../config/database');
const logger = require('../utils/logger');

const DIRECTORIES = [
  {
    name: 'STAFF_ALL',
    url: 'http://griet.ac.in/staff.php',
    baseUrl: 'https://www.griet.ac.in/',
    dept: null,
    parser: parseStaffPhpDirectory,
  },
  {
    name: 'CSE',
    url: 'http://www.cse.griet.ac.in/facultydirectory.html',
    baseUrl: 'http://www.cse.griet.ac.in/',
    dept: 'CSE',
    parser: parseCseDirectory,
  },
  {
    name: 'AIML',
    url: 'http://www.aiml.griet.ac.in/facultydirectory.html',
    baseUrl: 'http://www.aiml.griet.ac.in/',
    dept: 'AIML',
    parser: parseAimlDirectory,
  },
  {
    name: 'ME',
    url: 'http://www.me.griet.ac.in/faculty.html',
    baseUrl: 'http://www.me.griet.ac.in/',
    dept: 'ME',
    parser: parseMeDirectory,
  },
  {
    name: 'IT',
    url: 'http://www.it.griet.ac.in/faculty.html',
    baseUrl: 'http://www.it.griet.ac.in/',
    dept: 'IT',
    parser: parseItDirectory,
  },
  {
    name: 'ECE',
    url: 'http://www.ece.griet.ac.in/department_faculty.html',
    baseUrl: 'http://www.ece.griet.ac.in/',
    dept: 'ECE',
    parser: parseEceDirectory,
  },
  {
    name: 'EEE',
    url: 'http://www.eeedept.griet.ac.in/department_faculty.html',
    baseUrl: 'http://www.eeedept.griet.ac.in/',
    dept: 'EEE',
    parser: parseEeeDirectory,
  },
  {
    name: 'CE',
    url: 'http://www.ce.griet.ac.in/department_facultydirectory.html',
    baseUrl: 'http://www.ce.griet.ac.in/',
    dept: 'CE',
    parser: parseCeDirectory,
  },
  {
    name: 'H & BS',
    url: 'http://hs.griet.ac.in/facultydata.html',
    baseUrl: 'http://hs.griet.ac.in/',
    dept: 'H & BS',
    parser: parseHsDirectory,
  },
];

function normalizeName(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\b(dr|prof|mr|mrs|ms|sri|smt)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function resolveUrl(relativeOrAbsolute, baseUrl) {
  if (!relativeOrAbsolute) return null;
  const clean = relativeOrAbsolute.trim();
  if (!clean || clean === '#' || clean.startsWith('javascript:')) return null;
  try {
    return new URL(clean, baseUrl).href;
  } catch {
    return null;
  }
}

function parseStaffPhpDirectory(html, baseUrl) {
  const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const results = [];

  for (const tr of trMatches) {
    const rowContent = tr[1];
    const tds = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    );

    // Format: S.No, JNTUH Reg / Staff ID, Name, Designation, Qualification, Dept, Photo
    if (tds.length >= 6 && tds[0]?.match(/^\d+$/) && tds[2]) {
      const rawImgSrc = rowContent.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
      let imgUrl = null;
      if (rawImgSrc && !rawImgSrc.toLowerCase().includes('logo')) {
        try {
          imgUrl = new URL(rawImgSrc, baseUrl || 'https://www.griet.ac.in/').href;
        } catch {}
      }

      results.push({
        name: tds[2],
        staffId: tds[1] || null,
        designation: tds[3] || null,
        qualification: tds[4] || null,
        department: tds[5] || null,
        email: null,
        imageSourceUrl: imgUrl,
        profileSourceUrl: null,
      });
    }
  }
  return results;
}

function parseCseDirectory(html, baseUrl, dept) {
  const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const results = [];

  for (const tr of trMatches) {
    const rowContent = tr[1];
    const tds = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    );

    if (tds.length >= 8) {
      const staffIdMatch = tds[3]?.match(/^\d+$/);
      if (staffIdMatch) {
        const rawImgSrc = rowContent.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
        const rawHref = rowContent.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1];

        const validImg = rawImgSrc && rawImgSrc !== 'images/' && !rawImgSrc.endsWith('/');
        const validHref = rawHref && rawHref !== '#' && !rawHref.startsWith('javascript:');

        results.push({
          name: tds[1],
          designation: tds[2] || null,
          staffId: tds[3],
          email: tds[5]?.includes('@') ? tds[5].replace(/\s+/g, '') : null,
          imageSourceUrl: validImg ? resolveUrl(rawImgSrc, baseUrl) : null,
          profileSourceUrl: validHref ? resolveUrl(rawHref, baseUrl) : null,
          department: dept,
        });
      }
    }
  }
  return results;
}

function parseAimlDirectory(html, baseUrl, dept) {
  const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const results = [];

  for (const tr of trMatches) {
    const rowContent = tr[1];
    const tds = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    );

    if (tds.length >= 5 && tds[0]?.match(/^\d+\.?$/) && tds[1]) {
      const rawImgSrc = rowContent.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
      const rawHref = rowContent.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1];

      const validImg = rawImgSrc && rawImgSrc !== 'images/' && !rawImgSrc.endsWith('/');
      const validHref = rawHref && rawHref !== '#' && !rawHref.startsWith('javascript:');

      let email = null;
      for (const td of tds) {
        if (td.includes('@')) {
          const match = td.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (match) {
            email = match[0];
            break;
          }
        }
      }

      results.push({
        name: tds[1],
        designation: tds[2] || null,
        staffId: tds[3]?.match(/^\d+$/) ? tds[3] : (tds[5]?.match(/^\d+/) ? tds[5] : null),
        email,
        imageSourceUrl: validImg ? resolveUrl(rawImgSrc, baseUrl) : null,
        profileSourceUrl: validHref ? resolveUrl(rawHref, baseUrl) : null,
        department: dept,
      });
    }
  }
  return results;
}

function parseMeDirectory(html, baseUrl, dept) {
  const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const results = [];

  for (const tr of trMatches) {
    const rowContent = tr[1];
    const tds = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    );

    if (tds.length >= 4 && tds[0]?.match(/^\d+$/) && tds[1]) {
      const rawImgSrc = rowContent.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
      const linkMatches = [...rowContent.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
      let profileHref = null;
      let email = null;

      for (const lm of linkMatches) {
        const href = lm[1].trim();
        if (href.startsWith('mailto:')) {
          email = href.replace('mailto:', '').trim();
        } else if (href.endsWith('.html') || href.endsWith('.pdf')) {
          profileHref = href;
        }
      }

      if (!email && tds[3]?.includes('@')) {
        const emailMatch = tds[3].match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) email = emailMatch[0];
      }

      results.push({
        name: tds[1],
        designation: tds[2] || null,
        staffId: null,
        email: email || null,
        imageSourceUrl: rawImgSrc ? resolveUrl(rawImgSrc, baseUrl) : null,
        profileSourceUrl: profileHref ? resolveUrl(profileHref, baseUrl) : null,
        department: dept,
      });
    }
  }
  return results;
}

function parseItDirectory(html, baseUrl, dept) {
  const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const results = [];

  for (const tr of trMatches) {
    const rowContent = tr[1];
    const tds = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    );

    if (tds.length >= 4 && tds[0]?.match(/^\d+$/) && tds[1]) {
      const rawImgSrc = rowContent.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
      const rawHref = rowContent.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1];
      let email = null;
      if (tds[3]?.includes('@')) {
        const match = tds[3].match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (match) email = match[0];
      }

      results.push({
        name: tds[1],
        designation: tds[2] || null,
        staffId: null,
        email: email || null,
        imageSourceUrl: rawImgSrc ? resolveUrl(rawImgSrc, baseUrl) : null,
        profileSourceUrl: rawHref ? resolveUrl(rawHref, baseUrl) : null,
        department: dept,
      });
    }
  }
  return results;
}

function parseEceDirectory(html, baseUrl, dept) {
  const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const results = [];

  for (const tr of trMatches) {
    const rowContent = tr[1];
    const tds = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    );

    if (tds.length >= 3 && tds[0]?.match(/^\d+$/) && tds[1]) {
      const rawImgSrc = rowContent.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
      const rawHref = rowContent.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1];
      results.push({
        name: tds[1],
        designation: tds[2] || null,
        staffId: null,
        email: null,
        imageSourceUrl: rawImgSrc ? resolveUrl(rawImgSrc, baseUrl) : null,
        profileSourceUrl: rawHref ? resolveUrl(rawHref, baseUrl) : null,
        department: dept,
      });
    }
  }
  return results;
}

function parseEeeDirectory(html, baseUrl, dept) {
  const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const results = [];

  for (const tr of trMatches) {
    const rowContent = tr[1];
    const tds = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    );

    if (tds.length >= 4 && tds[0]?.match(/^\d+$/) && tds[1]) {
      const rawImgSrc = rowContent.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
      const rawHref = rowContent.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1];

      const validImg = rawImgSrc && rawImgSrc !== 'images/' && !rawImgSrc.endsWith('/');
      const validHref = rawHref && rawHref !== '#' && !rawHref.startsWith('javascript:');

      results.push({
        name: tds[1],
        staffId: tds[2]?.match(/^\d+$/) ? tds[2] : null,
        qualification: tds[3] || null,
        designation: tds[5] || tds[4] || null,
        email: null,
        imageSourceUrl: validImg ? resolveUrl(rawImgSrc, baseUrl) : null,
        profileSourceUrl: validHref ? resolveUrl(rawHref, baseUrl) : null,
        department: dept,
      });
    }
  }
  return results;
}

function parseCeDirectory(html, baseUrl, dept) {
  const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const results = [];

  for (const tr of trMatches) {
    const rowContent = tr[1];
    const tds = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    );

    if (tds.length >= 3 && tds[0]?.match(/^\d+$/) && tds[1]) {
      const rawImgSrc = rowContent.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
      const rawHref = rowContent.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1];

      let email = null;
      for (const td of tds) {
        if (td.includes('@')) {
          const match = td.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (match) {
            email = match[0];
            break;
          }
        }
      }

      results.push({
        name: tds[1],
        designation: tds[2] || null,
        staffId: null,
        email,
        imageSourceUrl: rawImgSrc ? resolveUrl(rawImgSrc, baseUrl) : null,
        profileSourceUrl: rawHref ? resolveUrl(rawHref, baseUrl) : null,
        department: dept,
      });
    }
  }
  return results;
}

function parseHsDirectory(html, baseUrl, dept) {
  const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const results = [];

  for (const tr of trMatches) {
    const rowContent = tr[1];
    const tds = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    );

    if (tds.length >= 4 && tds[0]?.match(/^\d+$/) && tds[1]) {
      const rawImgSrc = rowContent.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
      const rawHref = rowContent.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1];

      results.push({
        name: tds[1],
        staffId: tds[2]?.match(/^\d+$/) ? tds[2] : null,
        qualification: tds[3] || null,
        designation: tds[5] || tds[4] || null,
        email: null,
        imageSourceUrl: rawImgSrc ? resolveUrl(rawImgSrc, baseUrl) : null,
        profileSourceUrl: rawHref ? resolveUrl(rawHref, baseUrl) : null,
        department: dept,
      });
    }
  }
  return results;
}

async function fetchDirectoryFaculty() {
  const allFaculty = [];
  for (const dir of DIRECTORIES) {
    try {
      const response = await fetch(dir.url, {
        signal: AbortSignal.timeout(10000),
        headers: { 'user-agent': 'Timetable-Management-System/1.0' },
      });
      if (!response.ok) {
        logger.warn(`Failed to fetch directory ${dir.name}: HTTP ${response.status}`);
        continue;
      }
      const html = await response.text();
      const parsed = dir.parser(html, dir.baseUrl, dir.dept);
      logger.info(`Parsed ${parsed.length} faculty from ${dir.name} directory`);
      allFaculty.push(...parsed);
    } catch (err) {
      logger.warn(`Error fetching directory ${dir.name}: ${err.message}`);
    }
  }
  return allFaculty;
}

async function inspectProfileForDetails(profileUrl) {
  if (!profileUrl || profileUrl.toLowerCase().endsWith('.pdf')) {
    return { imageUrl: null, designation: null };
  }
  try {
    const response = await fetch(profileUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'Timetable-Management-System/1.0' },
    });
    if (!response.ok) return { imageUrl: null, designation: null };
    const html = await response.text();

    let designation = null;
    const desigMatch = html.match(
      /\b(Professor\s*&\s*HOD|Professor\s*&\s*Dean|Professor\s*&\s*COE|Associate\s+Professor|Assistant\s+Professor|Professor)\b/i
    );
    if (desigMatch) {
      designation = desigMatch[1].trim();
    }

    let imageUrl = null;
    const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
    for (const src of imgMatches) {
      if (
        (src.includes('department') || src.includes('faculty') || src.includes('images/') || src.includes('fac/')) &&
        !src.toLowerCase().includes('logo') &&
        !src.toLowerCase().includes('header') &&
        !src.toLowerCase().includes('banner') &&
        !src.toLowerCase().includes('accred')
      ) {
        imageUrl = resolveUrl(src, profileUrl);
        break;
      }
    }

    return { imageUrl, designation };
  } catch {
    return { imageUrl: null, designation: null };
  }
}

function findMatchesForFaculty(dbFaculty, scrapedList) {
  const matches = [];
  const dbNorm = normalizeName(dbFaculty.name);

  for (const s of scrapedList) {
    let matched = false;

    // 1. Staff ID match
    if (dbFaculty.staffId && s.staffId) {
      const sId = String(s.staffId).trim();
      const dId = String(dbFaculty.staffId).trim();
      if (sId === dId) {
        matched = true;
      }
    }

    // 2. Normalized name match
    if (!matched && dbNorm) {
      const sNorm = normalizeName(s.name);
      if (sNorm && sNorm === dbNorm) {
        matched = true;
      } else if (
        sNorm &&
        dbNorm.length > 5 &&
        sNorm.length > 5 &&
        (sNorm.includes(dbNorm) || dbNorm.includes(sNorm))
      ) {
        matched = true;
      }
    }

    if (matched) {
      matches.push(s);
    }
  }

  return matches;
}

function mergeMatchedRecords(matches) {
  if (!matches || matches.length === 0) return null;

  const merged = {
    name: matches[0].name,
    staffId: null,
    designation: null,
    qualification: null,
    department: null,
    email: null,
    imageSourceUrl: null,
    profileSourceUrl: null,
  };

  for (const m of matches) {
    if (!merged.staffId && m.staffId) merged.staffId = m.staffId;
    if (!merged.designation && m.designation && m.designation.toLowerCase() !== 'faculty') {
      merged.designation = m.designation;
    }
    if (!merged.qualification && m.qualification) merged.qualification = m.qualification;
    if (!merged.department && m.department) merged.department = m.department;
    if (!merged.email && m.email) merged.email = m.email;

    // Prefer images from central directory (fac/...) or valid department images
    if (!merged.imageSourceUrl && m.imageSourceUrl) {
      merged.imageSourceUrl = m.imageSourceUrl;
    } else if (m.imageSourceUrl && (m.imageSourceUrl.includes('/fac/') || m.imageSourceUrl.includes('images/'))) {
      merged.imageSourceUrl = m.imageSourceUrl;
    }

    if (!merged.profileSourceUrl && m.profileSourceUrl) {
      merged.profileSourceUrl = m.profileSourceUrl;
    }
  }

  return merged;
}

async function scrapeAndUpdateFaculty({ facultyId = null } = {}) {
  const where = facultyId ? { id: Number(facultyId) } : {};
  const facultyInDb = await prisma.faculty.findMany({ where });

  if (facultyInDb.length === 0) {
    return {
      success: true,
      totalDbFaculty: 0,
      matchedCount: 0,
      updatedCount: 0,
      imageUrlsAssigned: 0,
      pdfQueue: [],
      details: [],
    };
  }

  const scrapedList = await fetchDirectoryFaculty();
  let matchedCount = 0;
  let updatedCount = 0;
  let imageUrlsAssigned = 0;
  const pdfQueue = [];
  const details = [];

  for (const fac of facultyInDb) {
    const matches = findMatchesForFaculty(fac, scrapedList);
    const matched = mergeMatchedRecords(matches);

    if (!matched) {
      details.push({
        id: fac.id,
        name: fac.name,
        staffId: fac.staffId,
        matched: false,
        message: 'No web profile found in online directories',
      });
      continue;
    }

    matchedCount += 1;
    let finalImageUrl = matched.imageSourceUrl || fac.imageSourceUrl;
    const finalProfileUrl = matched.profileSourceUrl || fac.profileSourceUrl;
    let extractedDesig = matched.designation || fac.designation;

    const isPdfProfile = Boolean(finalProfileUrl && finalProfileUrl.toLowerCase().endsWith('.pdf'));

    // If profile is an HTML page (not PDF), inspect it for deeper image/designation details if missing
    if (finalProfileUrl && !isPdfProfile && (!finalImageUrl || !extractedDesig || extractedDesig.toLowerCase() === 'faculty')) {
      const deepDetails = await inspectProfileForDetails(finalProfileUrl);
      if (!finalImageUrl && deepDetails.imageUrl) {
        finalImageUrl = deepDetails.imageUrl;
      }
      if ((!extractedDesig || extractedDesig.toLowerCase() === 'faculty') && deepDetails.designation) {
        extractedDesig = deepDetails.designation;
      }
    }

    // Queue PDF profiles for deferred processing
    if (isPdfProfile) {
      pdfQueue.push({
        facultyId: fac.id,
        name: fac.name,
        staffId: fac.staffId || matched.staffId,
        department: fac.department || matched.department,
        designation: extractedDesig,
        pdfUrl: finalProfileUrl,
      });
    }

    if (finalImageUrl && (!fac.imageSourceUrl || fac.imageSourceUrl !== finalImageUrl)) {
      imageUrlsAssigned += 1;
    }

    // Only update URLs, text attributes and metadata.
    // Ensure binary imageData is completely removed / set to null per requirement.
    const updateData = {
      profileSourceUrl: finalProfileUrl || fac.profileSourceUrl,
      imageSourceUrl: finalImageUrl || fac.imageSourceUrl,
      imageData: null,
      imageMimeType: null,
      lastScrapedAt: new Date(),
    };

    if (matched.email && !fac.email) updateData.email = matched.email;
    if (extractedDesig) updateData.designation = extractedDesig;
    if (matched.department && !fac.department) updateData.department = matched.department;
    if (matched.qualification && !fac.qualification) updateData.qualification = matched.qualification;
    if (matched.staffId && !fac.staffId) updateData.staffId = matched.staffId;

    await prisma.faculty.update({
      where: { id: fac.id },
      data: updateData,
    });

    updatedCount += 1;
    details.push({
      id: fac.id,
      name: fac.name,
      staffId: fac.staffId || matched.staffId,
      matched: true,
      profileSourceUrl: updateData.profileSourceUrl,
      imageSourceUrl: updateData.imageSourceUrl,
      isPdfProfile,
      email: updateData.email || fac.email,
      designation: updateData.designation || fac.designation,
      qualification: updateData.qualification || fac.qualification,
      department: updateData.department || fac.department,
    });
  }

  return {
    success: true,
    totalDbFaculty: facultyInDb.length,
    matchedCount,
    updatedCount,
    imageUrlsAssigned,
    pdfQueue,
    details,
  };
}

module.exports = {
  scrapeAndUpdateFaculty,
  fetchDirectoryFaculty,
  inspectProfileForDetails,
  normalizeName,
  resolveUrl,
  parseStaffPhpDirectory,
  parseCseDirectory,
  parseAimlDirectory,
  parseMeDirectory,
  parseItDirectory,
  parseEceDirectory,
  parseEeeDirectory,
  parseCeDirectory,
  parseHsDirectory,
  findMatchesForFaculty,
  mergeMatchedRecords,
};
