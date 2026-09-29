export const choiceProjectionGridClass = (optionCount: number): string =>
  optionCount <= 4
    ? "lg:grid-cols-2"
    : optionCount <= 6
      ? "lg:grid-cols-3"
      : "lg:grid-cols-4";

export const questionProjectionTextClass = (text: string): string => {
  const length = Array.from(text.trim()).length;

  if (length > 140) {
    return "text-xl leading-8 sm:text-2xl sm:leading-9 xl:text-3xl";
  }
  if (length > 90) {
    return "text-2xl leading-9 sm:text-3xl sm:leading-10 xl:text-4xl";
  }
  return "text-2xl leading-tight sm:text-4xl xl:text-5xl";
};

export const choiceOptionProjectionTextClass = (
  optionCount: number,
  text: string,
): string => {
  const length = Array.from(text.trim()).length;

  if (optionCount > 8 || length > 55) {
    return "line-clamp-4 text-xs leading-4 sm:text-sm sm:leading-5";
  }
  if (optionCount > 6 || length > 35) {
    return "line-clamp-3 text-sm leading-5 sm:text-base sm:leading-6";
  }
  return "line-clamp-2 text-sm leading-5 sm:text-base xl:text-lg";
};

export const contentProjectionTextClass = (text: string): string => {
  const length = Array.from(text.trim()).length;

  if (length > 420) {
    return "text-sm leading-6 sm:text-base sm:leading-7";
  }
  if (length > 260) {
    return "text-base leading-7 sm:text-lg sm:leading-8";
  }
  return "text-lg leading-8 sm:text-xl sm:leading-9";
};
