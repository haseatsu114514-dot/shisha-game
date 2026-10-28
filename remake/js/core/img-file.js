// remake/img/ に配置済みの画像を、manifest 読込前でも同じ URL で参照する。
export function imgFileUrl(rel) {
  return new URL("../../img/" + rel, import.meta.url).href;
}
