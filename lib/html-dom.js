export function parse(html) {
  return new DOMParser().parseFromString(html, "text/html");
}
