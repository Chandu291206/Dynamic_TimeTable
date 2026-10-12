const prisma = require('../config/database');
const logger = require('../utils/logger');

const DIRECTORIES = [
  {
    name: 'CSE',
    url: 'http://www.cse.griet.ac.in/facultydirectory.html',
    baseUrl: 'http://www.cse.griet.ac.in/',
    dept: 'CSE',
    parser: parseCseDirectory,
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

function parseMeDirectory(html, baseUrl, dept) {
  const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const results = [];

  for (const tr of trMatches) {
    const rowContent = tr[1];
    const tds = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    );

    // ME format: td[0]=S.No, td[1]=Name, td[2]=Designation, td[3]=Email/Phone, td[4]=Profile link
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
  if (!profileUrl || profileUrl.endsWith('.pdf')) return { imageUrl: null, designation: null };
  try {
    const response = await fetch(profileUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'Timetable-Management-System/1.0' },
    });
    if (!response.ok) return { imageUrl: null, designation: null };
    const html = await response.text();

    let designation = null;
    const desigMatch = html.match(/\b(Professor\s*&\s*HOD|Professor\s*&\s*Dean|Professor\s*&\s*COE|Associate\s+Professor|Assistant\s+Professor|Professor)\b/i);
    if (desigMatch) {
      designation = desigMatch[1].trim();
    }

    let imageUrl = null;
    const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
    for (const src of imgMatches) {
      if (
        (src.includes('department') || src.includes('faculty') || src.includes('images/')) &&
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

async function inspectProfileForImage(profileUrl) {
  const details = await inspectProfileForDetails(profileUrl);
  return details.imageUrl;
}

async function fetchImageBinary(imageUrl) {
  if (!imageUrl) return null;
  try {
    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { 'user-agent': 'Timetable-Management-System/1.0' },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) return null;
    return { buffer, mimeType: contentType.split(';')[0].trim() };
  } catch (err) {
    logger.warn(`Failed to download faculty image from ${imageUrl}: ${err.message}`);
    return null;
  }
}

function matchFaculty(dbFaculty, scrapedList) {
  if (dbFaculty.staffId) {
    const byId = scrapedList.find((s) => s.staffId && s.staffId === dbFaculty.staffId);
    if (byId) return byId;
  }

  const dbNorm = normalizeName(dbFaculty.name);
  if (!dbNorm) return null;

  const exactNorm = scrapedList.find((s) => normalizeName(s.name) === dbNorm);
  if (exactNorm) return exactNorm;

  const substringMatch = scrapedList.find((s) => {
    const sNorm = normalizeName(s.name);
    return sNorm.length > 4 && (sNorm.includes(dbNorm) || dbNorm.includes(sNorm));
  });
  if (substringMatch) return substringMatch;

  return null;
}

async function scrapeAndUpdateFaculty({ facultyId = null, downloadImages = true } = {}) {
  const where = facultyId ? { id: Number(facultyId) } : {};
  const facultyInDb = await prisma.faculty.findMany({ where });

  if (facultyInDb.length === 0) {
    return { success: true, totalDbFaculty: 0, matchedCount: 0, updatedCount: 0, imagesDownloaded: 0, details: [] };
  }

  const scrapedList = await fetchDirectoryFaculty();
  let matchedCount = 0;
  let updatedCount = 0;
  let imagesDownloaded = 0;
  const details = [];

  for (const fac of facultyInDb) {
    const matched = matchFaculty(fac, scrapedList);
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
    let finalImageUrl = matched.imageSourceUrl;
    const finalProfileUrl = matched.profileSourceUrl || fac.profileSourceUrl;
    let extractedDesig = matched.designation;

    if (finalProfileUrl && (!finalImageUrl || !extractedDesig || extractedDesig.toLowerCase() === 'faculty')) {
      const deepDetails = await inspectProfileForDetails(finalProfileUrl);
      if (!finalImageUrl && deepDetails.imageUrl) {
        finalImageUrl = deepDetails.imageUrl;
      }
      if ((!extractedDesig || extractedDesig.toLowerCase() === 'faculty') && deepDetails.designation) {
        extractedDesig = deepDetails.designation;
      }
    }

    let imgData = null;
    let imgMime = null;

    if (downloadImages && finalImageUrl && (!fac.imageData || fac.imageSourceUrl !== finalImageUrl)) {
      const imgRes = await fetchImageBinary(finalImageUrl);
      if (imgRes) {
        imgData = imgRes.buffer;
        imgMime = imgRes.mimeType;
        imagesDownloaded += 1;
      }
    }

    const updateData = {
      profileSourceUrl: finalProfileUrl || fac.profileSourceUrl,
      imageSourceUrl: finalImageUrl || fac.imageSourceUrl,
      lastScrapedAt: new Date(),
    };

    if (matched.email) updateData.email = matched.email;
    if (extractedDesig) updateData.designation = extractedDesig;
    if (matched.department) updateData.department = matched.department;
    if (matched.staffId && !fac.staffId) updateData.staffId = matched.staffId;
    if (imgData && imgMime) {
      updateData.imageData = imgData;
      updateData.imageMimeType = imgMime;
    }

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
      hasImageDownloaded: !!imgData || !!fac.imageData,
      email: updateData.email || fac.email,
      designation: updateData.designation || fac.designation,
      department: updateData.department || fac.department,
    });
  }

  return {
    success: true,
    totalDbFaculty: facultyInDb.length,
    matchedCount,
    updatedCount,
    imagesDownloaded,
    details,
  };
}

module.exports = {
  scrapeAndUpdateFaculty,
  fetchDirectoryFaculty,
  fetchImageBinary,
  inspectProfileForImage,
  normalizeName,
  resolveUrl,
  parseCseDirectory,
  parseMeDirectory,
  parseItDirectory,
  parseEceDirectory,
};
