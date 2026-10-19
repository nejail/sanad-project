import { formatPhone, isValidPlate, isValidQatarMobile, isValidYear, normalizePhone, normalizePlate } from '../src/models/validation';

describe('phone numbers', () => {
  it('accepts 8-digit Qatar mobiles starting with 3, 5, 6 or 7', () => {
    ['50123456', '33123456', '66123456', '77123456'].forEach((p) => expect(isValidQatarMobile(p)).toBe(true));
  });
  it('rejects landlines, short numbers and wrong prefixes', () => {
    ['44123456', '5012345', '90123456', ''].forEach((p) => expect(isValidQatarMobile(p)).toBe(false));
  });
  it('strips +974, spaces and dashes', () => {
    expect(normalizePhone('+974 5012-3456')).toBe('50123456');
    expect(formatPhone('50123456')).toBe('5012 3456');
  });
});

describe('cars', () => {
  it('formats plates as QA-<digits>', () => {
    expect(normalizePlate('1234')).toBe('QA-1234');
    expect(normalizePlate('qa 5678')).toBe('QA-5678');
    expect(isValidPlate('')).toBe(false);
  });
  it('accepts sensible model years only', () => {
    const now = new Date('2026-10-19');
    expect(isValidYear('2023', now)).toBe(true);
    expect(isValidYear('2027', now)).toBe(true);
    expect(isValidYear('1975', now)).toBe(false);
    expect(isValidYear('20x3', now)).toBe(false);
  });
});
