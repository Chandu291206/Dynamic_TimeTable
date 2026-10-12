const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeName,
  resolveUrl,
  parseCseDirectory,
  parseMeDirectory,
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
});
