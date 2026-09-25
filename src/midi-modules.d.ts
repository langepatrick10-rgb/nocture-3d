declare module '*.mid' {
  const src: string
  export default src
}

declare module '*.mid?url' {
  const src: string
  export default src
}

declare module '*.json' {
  const value: unknown
  export default value
}
