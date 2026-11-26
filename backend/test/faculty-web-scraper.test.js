const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeName,
  resolveUrl,
  parseCseDirectory,
  parseMeDirectory,
  parseAimlDirectory,
  parseEeeDirectory,
  parseCeDirectory,
  parseHsDirectory,
  parseDsDirectory,
  parseCsbsDirectory,
  parseStaffPhpDirectory,
  findMatchesForFaculty,
  mergeMatchedRecords,
} = require('../src/services/faculty-web-scraper.service');

describe('Faculty Web Scraper Service', () => {
  it('normalizes faculty names by stripping titles, dots, and case', () => {
    assert.equal(normalizeName('Dr. B. Sankara Babu'), 'bsankarababu');
    assert.equal(normalizeName('Prof. G. Mallikarjuna Rao'), 'gmallikarjunarao');
    assert.equal(normalizeName('Mr. K.Sunil Kumar Reddy'), 'ksunilkumarreddy');
    assert.equal(normalizeName('Lohitha Mallireddy'), 'lohithamallireddy');
  });

  it('resolves relative URLs safely', () => {
    const base = 'http://www.cse.griet.ac.in/';
    assert.equal(resolveUrl('images/lohitha.jpg', base), 'http://www.cse.griet.ac.in/images/lohitha.jpg');
    assert.equal(resolveUrl('lohitha.html', base), 'http://www.cse.griet.ac.in/lohitha.html');
    assert.equal(resolveUrl('http://example.com/pic.jpg', base), 'http://example.com/pic.jpg');
    assert.equal(resolveUrl('#', base), null);
    assert.equal(resolveUrl('javascript:void(0)', base), null);
    assert.equal(resolveUrl('', base), null);
  });

  it('parses CSE directory HTML rows accurately', () => {
    const sampleHtml = `
      <table>
        <tr>
          <td>1.</td>
          <td>Lohitha Mallireddy</td>
          <td>Assistant Professor</td>
          <td>1818</td>
          <td>01/01/2023</td>
          <td>lohitham87@gmail.com</td>
          <td>123456</td>
          <td><img src="images/lohitha.jpg"><a href="lohitha.html">Click</a></td>
        </tr>
      </table>
    `;
    const parsed = parseCseDirectory(sampleHtml, 'http://www.cse.griet.ac.in/', 'CSE');
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].name, 'Lohitha Mallireddy');
    assert.equal(parsed[0].staffId, '1818');
    assert.equal(parsed[0].designation, 'Assistant Professor');
    assert.equal(parsed[0].email, 'lohitham87@gmail.com');
    assert.equal(parsed[0].imageSourceUrl, 'http://www.cse.griet.ac.in/images/lohitha.jpg');
    assert.equal(parsed[0].profileSourceUrl, 'http://www.cse.griet.ac.in/lohitha.html');
    assert.equal(parsed[0].department, 'CSE');
  });

  it('parses ME directory HTML rows accurately', () => {
    const sampleHtml = `
      <table>
        <tr>
          <td>10</td>
          <td>Dr. K. Sunil Kumar Reddy</td>
          <td>Associate Professor</td>
          <td><a href="mailto:kadaru.s@gmail.com">kadaru.s@gmail.com</a></td>
          <td><a href="sunilkumarreddy.html">Click Here</a></td>
        </tr>
      </table>
    `;
    const parsed = parseMeDirectory(sampleHtml, 'http://www.me.griet.ac.in/', 'ME');
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].name, 'Dr. K. Sunil Kumar Reddy');
    assert.equal(parsed[0].designation, 'Associate Professor');
    assert.equal(parsed[0].email, 'kadaru.s@gmail.com');
    assert.equal(parsed[0].profileSourceUrl, 'http://www.me.griet.ac.in/sunilkumarreddy.html');
    assert.equal(parsed[0].department, 'ME');
  });

  it('parses AIML directory HTML rows accurately', () => {
    const sampleHtml = `
      <table>
        <tr>
          <td>1.</td>
          <td>Dr. G Karuna</td>
          <td>Professor & Head</td>
          <td>922</td>
          <td>hod_aimle@griet.ac.in</td>
          <td>85150331-125201</td>
          <td><img src="images/gkaruna922.jpg"><a href="gkaruna922.html">Click</a></td>
        </tr>
      </table>
    `;
    const parsed = parseAimlDirectory(sampleHtml, 'http://www.aiml.griet.ac.in/', 'AIML');
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].name, 'Dr. G Karuna');
    assert.equal(parsed[0].staffId, '922');
    assert.equal(parsed[0].email, 'hod_aimle@griet.ac.in');
    assert.equal(parsed[0].imageSourceUrl, 'http://www.aiml.griet.ac.in/images/gkaruna922.jpg');
    assert.equal(parsed[0].profileSourceUrl, 'http://www.aiml.griet.ac.in/gkaruna922.html');
    assert.equal(parsed[0].department, 'AIML');
  });

  it('parses EEE directory HTML rows accurately with PDF profile', () => {
    const sampleHtml = `
      <table>
        <tr>
          <td>1</td>
          <td>Dr. J.Praveen</td>
          <td>1079</td>
          <td>Ph.D</td>
          <td>Power Electronics</td>
          <td>Professor & Principal</td>
          <td><img src="images/faculty/JP.png"><a href="document/Dr. J.Praveen.pdf">Click</a></td>
        </tr>
      </table>
    `;
    const parsed = parseEeeDirectory(sampleHtml, 'http://www.eeedept.griet.ac.in/', 'EEE');
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].name, 'Dr. J.Praveen');
    assert.equal(parsed[0].staffId, '1079');
    assert.equal(parsed[0].qualification, 'Ph.D');
    assert.equal(parsed[0].designation, 'Professor & Principal');
    assert.equal(parsed[0].profileSourceUrl, 'http://www.eeedept.griet.ac.in/document/Dr.%20J.Praveen.pdf');
    assert.equal(parsed[0].department, 'EEE');
  });

  it('parses Staff PHP directory accurately', () => {
    const sampleHtml = `
      <table>
        <tr>
          <td>1</td>
          <td>85150330-182657</td>
          <td>Dr. J.Praveen</td>
          <td>Professor</td>
          <td>Ph.D</td>
          <td>EEE</td>
          <td><img src="fac/Dr. J.Praveen.jpg" width="120" height="180"></td>
        </tr>
      </table>
    `;
    const parsed = parseStaffPhpDirectory(sampleHtml, 'https://www.griet.ac.in/');
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].name, 'Dr. J.Praveen');
    assert.equal(parsed[0].staffId, '85150330-182657');
    assert.equal(parsed[0].designation, 'Professor');
    assert.equal(parsed[0].qualification, 'Ph.D');
    assert.equal(parsed[0].department, 'EEE');
    assert.equal(parsed[0].imageSourceUrl, 'https://www.griet.ac.in/fac/Dr.%20J.Praveen.jpg');
  });

  it('parses DS directory HTML rows accurately', () => {
    const sampleHtml = `
      <table>
        <tr>
          <th>S.No.</th>
          <th>Name</th>
          <th>Designation</th>
          <th>Faculty ID</th>
          <th>Email Address</th>
          <th>JNTUH ID</th>
          <th>Photo</th>
          <th>Profile Page</th>
        </tr>
        <tr>
          <td>1</td>
          <td>Dr.S. Govind Rao</td>
          <td>Professor & HOD</td>
          <td>486</td>
          <td>govindsampathirao@gmail.com</td>
          <td>01150330-195657</td>
          <td><img src="images/govindrao.jpg" width="90" height="90"></td>
          <td><a href="Govindrao.html">Click here...</a></td>
        </tr>
      </table>
    `;
    const parsed = parseDsDirectory(sampleHtml, 'http://www.ds.griet.ac.in/', 'DS');
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].name, 'Dr.S. Govind Rao');
    assert.equal(parsed[0].staffId, '486');
    assert.equal(parsed[0].designation, 'Professor & HOD');
    assert.equal(parsed[0].email, 'govindsampathirao@gmail.com');
    assert.equal(parsed[0].imageSourceUrl, 'http://www.ds.griet.ac.in/images/govindrao.jpg');
    assert.equal(parsed[0].profileSourceUrl, 'http://www.ds.griet.ac.in/Govindrao.html');
    assert.equal(parsed[0].department, 'DS');
  });

  it('parses CSBS directory HTML rows accurately', () => {
    const sampleHtml = `
      <table>
        <tr>
          <th>S.No.</th>
          <th>Name</th>
          <th>Designation</th>
          <th>Faculty ID</th>
          <th>Email Address</th>
          <th>JNTUH ID</th>
          <th>Photo</th>
          <th>Profile Page</th>
        </tr>
        <tr>
          <td>1</td>
          <td>Dr. Mamidi Kiran Kumar</td>
          <td>Associate Professor & Dean AAC</td>
          <td>1610</td>
          <td>kirankumar1610@grietcollege.com</td>
          <td>8908-210628-151857</td>
          <td><img src="images/kiran1610.jpg" width="90" height="90"></td>
          <td><a href="kiran1610.html">Click here...</a></td>
        </tr>
      </table>
    `;
    const parsed = parseCsbsDirectory(sampleHtml, 'http://www.csbs.griet.ac.in/', 'CSBS');
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].name, 'Dr. Mamidi Kiran Kumar');
    assert.equal(parsed[0].staffId, '1610');
    assert.equal(parsed[0].designation, 'Associate Professor & Dean AAC');
    assert.equal(parsed[0].email, 'kirankumar1610@grietcollege.com');
    assert.equal(parsed[0].imageSourceUrl, 'http://www.csbs.griet.ac.in/images/kiran1610.jpg');
    assert.equal(parsed[0].profileSourceUrl, 'http://www.csbs.griet.ac.in/kiran1610.html');
    assert.equal(parsed[0].department, 'CSBS');
  });

  it('matches faculty strictly by staffId and NEVER by name alone', () => {
    const dbFaculty1 = { id: 1, name: 'Dr. A. Kumar', staffId: '1001' };
    const dbFaculty2 = { id: 2, name: 'Dr. A. Kumar', staffId: '1002' };

    const scrapedList = [
      { name: 'Dr. A. Kumar', staffId: '1001', designation: 'Professor' },
      { name: 'Dr. A. Kumar', staffId: '1002', designation: 'Associate Professor' },
      { name: 'Dr. A. Kumar', staffId: null, designation: 'Assistant Professor' },
    ];

    const match1 = findMatchesForFaculty(dbFaculty1, scrapedList);
    assert.equal(match1.length, 1);
    assert.equal(match1[0].staffId, '1001');
    assert.equal(match1[0].designation, 'Professor');

    const match2 = findMatchesForFaculty(dbFaculty2, scrapedList);
    assert.equal(match2.length, 1);
    assert.equal(match2[0].staffId, '1002');
    assert.equal(match2[0].designation, 'Associate Professor');

    // Faculty with no staffId in scrapedList does not match anyone
    const dbFaculty3 = { id: 3, name: 'Dr. A. Kumar', staffId: '1003' };
    const match3 = findMatchesForFaculty(dbFaculty3, scrapedList);
    assert.equal(match3.length, 0);
  });

  it('matches on faculty ID regardless of spelling differences in name and provides official name', () => {
    // Database has misspelled name or typo, but correct staffId
    const misspelledDbFaculty = { id: 42, name: 'Mohd. Asma Misspelled', staffId: '1908' };

    const scrapedList = [
      { name: 'Ms. Mohammad Asma', staffId: '1908', designation: 'Assistant Professor', department: 'DS' },
    ];

    const matches = findMatchesForFaculty(misspelledDbFaculty, scrapedList);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].staffId, '1908');

    const merged = mergeMatchedRecords(matches);
    assert.equal(merged.name, 'Ms. Mohammad Asma');
    assert.equal(merged.department, 'DS');
  });

  it('matches numeric faculty IDs with leading zeros seamlessly', () => {
    const dbFacultyWithZero = { id: 10, name: 'Dr. S. Govinda Rao', staffId: '0486' };
    const scrapedList = [
      { name: 'Dr. S. Govinda Rao', staffId: '486', designation: 'Professor & HOD', department: 'DS' },
    ];

    const matches = findMatchesForFaculty(dbFacultyWithZero, scrapedList);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].staffId, '486');
  });
});
