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
});
