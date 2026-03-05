const NATURAL_TERMINATOR_PATTERN = /[.!?…][)"'”’\]]*$/;

export function endsWithNaturalTerminator(text: string): boolean {
  const trimmed = text.trimEnd();
  if (!trimmed) {
    return false;
  }

  return NATURAL_TERMINATOR_PATTERN.test(trimmed);
}

