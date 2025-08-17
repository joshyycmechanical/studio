
import { formatEnum } from './utils';

describe('formatEnum', () => {
  it('should format a simple string', () => {
    expect(formatEnum('hello')).toBe('Hello');
  });

  it('should format a string with a hyphen', () => {
    expect(formatEnum('hello-world')).toBe('Hello World');
  });

  it('should format a string with an underscore', () => {
    expect(formatEnum('hello_world')).toBe('Hello World');
  });

  it('should return an empty string if the input is empty', () => {
    expect(formatEnum('')).toBe('');
  });
});
