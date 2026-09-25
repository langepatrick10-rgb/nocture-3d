export function publicUrl(file: string): string {
  return `${import.meta.env.BASE_URL}${file.replace(/^\//, '')}`
}
