// tests/indexNumberGenerator.test.js
const { generateExamIndexNumber } = require('../services/indexNumberGenerator');

describe('generateExamIndexNumber', () => {
  test('should throw error for invalid NIC', () => {
    expect(() => generateExamIndexNumber(null)).toThrow('Invalid NIC format');
    expect(() => generateExamIndexNumber(undefined)).toThrow('Invalid NIC format');
    expect(() => generateExamIndexNumber(123456)).toThrow('Invalid NIC format');
  });

  test('should generate 7-digit number with correct first digit for exam centers', () => {
    const nicTest = '123456789V';

    // Test Colombo (1)
    const colomboResult = generateExamIndexNumber(nicTest, 'Colombo', 'Bio Science');
    expect(colomboResult.charAt(0)).toBe('1');
    expect(colomboResult.length).toBe(7);

    // Test Kandy (2)
    const kandyResult = generateExamIndexNumber(nicTest, 'Kandy', 'Bio Science');
    expect(kandyResult.charAt(0)).toBe('2');
    expect(kandyResult.length).toBe(7);

    // Test Galle (3)
    const galleResult = generateExamIndexNumber(nicTest, 'Galle', 'Bio Science');
    expect(galleResult.charAt(0)).toBe('3');
    expect(galleResult.length).toBe(7);

    // Test unknown (9)
    const unknownResult = generateExamIndexNumber(nicTest, 'Unknown', 'Bio Science');
    expect(unknownResult.charAt(0)).toBe('9');
    expect(unknownResult.length).toBe(7);
  });

  test('should generate 7-digit number with correct second digit for streams', () => {
    const nicTest = '123456789V';

    // Test Bio Science (0)
    const bioResult = generateExamIndexNumber(nicTest, 'Colombo', 'Bio Science');
    expect(bioResult.charAt(1)).toBe('0');

    // Test Physical Science (1)
    const physicalResult = generateExamIndexNumber(nicTest, 'Colombo', 'Physical Science');
    expect(physicalResult.charAt(1)).toBe('1');

    // Test unknown stream (5)
    const unknownResult = generateExamIndexNumber(nicTest, 'Colombo', 'Other');
    expect(unknownResult.charAt(1)).toBe('5');
  });

  test('should handle exam center case insensitively', () => {
    const result1 = generateExamIndexNumber('123456789V', 'COLOMBO', 'Bio Science');
    const result2 = generateExamIndexNumber('123456789V', 'colombo', 'Bio Science');
    expect(result1).toBe(result2);
  });

  test('should handle stream case insensitively', () => {
    const result1 = generateExamIndexNumber('123456789V', 'Colombo', 'BIO SCIENCE');
    const result2 = generateExamIndexNumber('123456789V', 'Colombo', 'bio science');
    expect(result1).toBe(result2);
  });

  test('should generate consistent results for the same inputs', () => {
    const result1 = generateExamIndexNumber('123456789V', 'Colombo', 'Bio Science');
    const result2 = generateExamIndexNumber('123456789V', 'Colombo', 'Bio Science');
    expect(result1).toBe(result2);
  });

  test('should generate different results for different NICs', () => {
    const result1 = generateExamIndexNumber('123456789V', 'Colombo', 'Bio Science');
    const result2 = generateExamIndexNumber('987654321X', 'Colombo', 'Bio Science');
    expect(result1).not.toBe(result2);
  });

  test('should generate index numbers with last 5 digits from NIC', () => {
    const result = generateExamIndexNumber('123456789V', 'Colombo', 'Bio Science');
    const lastFiveDigits = result.substring(2);
    expect(lastFiveDigits).toMatch(/^\d{5}$/);
  });

  test('should handle null or undefined for optional parameters', () => {
    // Should use default values (9 for unknown center, 5 for unknown stream)
    const result1 = generateExamIndexNumber('123456789V', null, null);
    expect(result1.charAt(0)).toBe('9');
    expect(result1.charAt(1)).toBe('5');
    expect(result1.length).toBe(7);

    const result2 = generateExamIndexNumber('123456789V', undefined, undefined);
    expect(result2.charAt(0)).toBe('9');
    expect(result2.charAt(1)).toBe('5');
    expect(result2.length).toBe(7);
  });
});