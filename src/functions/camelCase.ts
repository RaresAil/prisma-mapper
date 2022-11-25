export const camelize = (str: string) => {
  // ignore uppercase letters
  if (str.toLocaleUpperCase() === str) {
    return str;
  }

  return str
    .replace(/_/g, ' ')
    .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, '');
};

export const capitalize = (str: string) => {
  const camelized = camelize(str);
  return camelized.charAt(0).toUpperCase() + camelized.slice(1);
};
